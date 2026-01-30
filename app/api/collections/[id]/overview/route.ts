import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient, getAuthenticatedServerClient } from "@/lib/supabase-server";
import { loadPrompt, replaceVars, generateStructuredData, generateMarkdown } from "@/lib/ai";
import {
  CollectionOverviewSchema,
  REQUIRED_SCHEMA_SUFFIX,
  type CollectionOverview,
  type DiscoveredFilter,
} from "@/types/collection-overview";
import {
  ResearcherSchema,
  CuratorSchema,
  STANDARD_SYSTEM_PROMPT,
  RESEARCHER_SYSTEM_PROMPT,
  CURATOR_SYSTEM_PROMPT,
  formatResearcherOutput,
  formatCuratorOutput,
  type ResearcherOutput,
  type CuratorOutput,
} from "@/lib/ai/prompts";
import type { Database } from "@/types/database";
import { extractDynamicAttributesForItems } from "@/lib/attribute-normalizer";

const CLAUDE_MODEL = "claude-3-5-sonnet-20240620";

type Collection = Database["public"]["Tables"]["collections"]["Row"];
type Item = Database["public"]["Tables"]["items"]["Row"];
type ItemAttribute = Database["public"]["Tables"]["item_attributes"]["Row"];
type AttributeSchema = Database["public"]["Tables"]["attribute_schemas"]["Row"];

interface ItemWithCollectionMetadata extends Item {
  collection_notes: string | null;
  collection_position: number | null;
}

interface ItemWithAttributes extends ItemWithCollectionMetadata {
  attributes_data?: Array<{
    schema_name: string;
    display_name: string;
    raw_value: string;
    normalized_value: string;
  }>;
}

/**
 * GET /api/collections/[id]/overview
 *
 * Returns cached overview if valid, otherwise returns null
 * Client should call POST to trigger generation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const collection = data as Collection;

    if (!collection.ai_overview_valid || !collection.ai_overview) {
      return NextResponse.json({
        success: true,
        overview: null,
        needs_generation: true,
        has_custom_prompt: !!collection.custom_prompt,
        ai_mode: collection.ai_mode,
      });
    }

    return NextResponse.json({
      success: true,
      overview: collection.ai_overview,
      generated_at: collection.ai_overview_generated_at,
      model: collection.ai_overview_model,
      needs_generation: false,
      has_custom_prompt: !!collection.custom_prompt,
      ai_mode: collection.ai_mode,
    });
  } catch (error) {
    console.error("Overview fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/collections/[id]/overview
 *
 * Generates AI overview for a collection (lazy-loaded, cached)
 * - Only generates if ai_overview_valid = false
 * - Stores result in collections.ai_overview
 * - Returns immediately if valid cache exists
 * - Supports three AI modes: standard, researcher, curator
 *
 * Query params:
 * - reprocess_filters=true: Skip AI generation, just reprocess filters from existing overview
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const reprocessFilters = url.searchParams.get("reprocess_filters") === "true";

    // Get authenticated user for owner check
    const { user, error: authError } = await getAuthenticatedServerClient();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getServiceRoleClient();

    // Step 1: Fetch collection with items
    const { data: collectionData, error: collectionError } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .single();

    if (collectionError || !collectionData) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const collection = collectionData as Collection;

    // Security: Only allow owner to trigger AI generation
    if (collection.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Handle reprocess_filters mode (only valid for standard mode)
    if (reprocessFilters) {
      if (collection.ai_mode !== "standard") {
        return NextResponse.json(
          { error: "Filter reprocessing only supported for standard mode" },
          { status: 400 }
        );
      }

      if (!collection.ai_overview) {
        return NextResponse.json(
          { error: "No existing AI overview to reprocess filters from" },
          { status: 400 }
        );
      }

      const existingOverview = JSON.parse(collection.ai_overview) as CollectionOverview;
      if (!existingOverview.discovered_filters || existingOverview.discovered_filters.length === 0) {
        return NextResponse.json(
          { error: "No discovered_filters in existing overview" },
          { status: 400 }
        );
      }

      // Fetch items for filter extraction
      const { data: collectionItems, error: itemsError } = await supabase
        .from("collection_items")
        .select(`position, notes, items (*)`)
        .eq("collection_id", id);

      if (itemsError) {
        return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
      }

      // @ts-ignore - Supabase returns nested structure
      const items: ItemWithCollectionMetadata[] = collectionItems.map((ci: any) => ({
        ...ci.items,
        collection_notes: ci.notes,
        collection_position: ci.position,
      }));

      console.log(`[Reprocess] Processing ${existingOverview.discovered_filters.length} filters for ${items.length} items`);

      const filterResult = await processDiscoveredFilters(
        supabase,
        id,
        existingOverview.discovered_filters,
        items
      );

      return NextResponse.json({
        success: true,
        mode: "reprocess_filters",
        filter_processing: filterResult,
        filters_attempted: existingOverview.discovered_filters.map(f => f.name),
      });
    }

    // Step 2: Check if overview is already valid
    if (collection.ai_overview_valid && collection.ai_overview) {
      return NextResponse.json({
        success: true,
        cached: true,
        overview: collection.ai_overview,
        generated_at: collection.ai_overview_generated_at,
        model: collection.ai_overview_model,
        has_custom_prompt: !!collection.custom_prompt,
        ai_mode: collection.ai_mode,
      });
    }

    // Step 3: Fetch items in collection with their attributes
    const { data: collectionItems, error: itemsError } = await supabase
      .from("collection_items")
      .select(
        `
        position,
        notes,
        items (*)
      `
      )
      .eq("collection_id", id)
      .order("position", { ascending: true, nullsFirst: false });

    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to fetch collection items" },
        { status: 500 }
      );
    }

    // @ts-ignore - Supabase returns nested structure
    const items: ItemWithCollectionMetadata[] = collectionItems.map(
      (ci: any) => ({
        ...ci.items,
        collection_notes: ci.notes,
        collection_position: ci.position,
      })
    );

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Cannot generate overview for empty collection" },
        { status: 400 }
      );
    }

    // Step 4: Fetch item attributes for enhanced context
    const itemIds = items.map(item => item.id);
    const { data: attributesData } = await supabase
      .from("item_attributes")
      .select(`
        item_id,
        raw_value,
        normalized_value,
        schema:attribute_schemas (name, display_name)
      `)
      .in("item_id", itemIds);

    // @ts-ignore - Supabase nested query
    const attributesByItem = new Map<string, Array<{ schema_name: string; display_name: string; raw_value: string; normalized_value: string }>>();
    if (attributesData) {
      for (const attr of attributesData as any[]) {
        if (!attr.schema) continue;
        if (!attributesByItem.has(attr.item_id)) {
          attributesByItem.set(attr.item_id, []);
        }
        attributesByItem.get(attr.item_id)!.push({
          schema_name: attr.schema.name,
          display_name: attr.schema.display_name,
          raw_value: attr.raw_value,
          normalized_value: attr.normalized_value,
        });
      }
    }

    // Attach attributes to items
    const itemsWithAttributes: ItemWithAttributes[] = items.map(item => ({
      ...item,
      attributes_data: attributesByItem.get(item.id) || [],
    }));

    // Step 5: Generate AI overview based on mode
    let overviewMarkdown: string;
    let filterResult: { processed: string[]; failed: Array<{ name: string; error: string }> } | null = null;

    const itemsJson = JSON.stringify(itemsWithAttributes, null, 2);

    switch (collection.ai_mode) {
      case "standard": {
        // Use custom_prompt if defined, otherwise use default template
        const isCustomPrompt = !!collection.custom_prompt;
        const baseTemplate = collection.custom_prompt || loadPrompt("collection_overview.txt");

        // Check if custom prompt already contains schema instructions
        const hasSchemaInstructions = isCustomPrompt && (
          baseTemplate.includes("REQUIRED RESPONSE FORMAT") ||
          baseTemplate.includes("value_type MUST be one of") ||
          baseTemplate.includes('"string", "number", "numeric_range"')
        );

        const promptTemplate = isCustomPrompt && !hasSchemaInstructions
          ? baseTemplate + REQUIRED_SCHEMA_SUFFIX
          : baseTemplate;

        const prompt = replaceVars(promptTemplate, {
          COLLECTION_NAME: collection.name,
          COLLECTION_DESCRIPTION: collection.description || "No description provided",
          COLLECTION_TYPE: collection.type || "General",
          ITEM_COUNT: items.length.toString(),
          ITEMS_JSON: itemsJson,
        });

        // Generate structured overview (legacy mode for backward compatibility)
        const overview = await generateStructuredData({
          model: CLAUDE_MODEL,
          schema: CollectionOverviewSchema,
          prompt,
          max_tokens: 2048,
        });

        // Convert to markdown
        overviewMarkdown = formatStandardOverview(overview);

        // Process discovered filters
        if (overview.discovered_filters && overview.discovered_filters.length > 0) {
          filterResult = await processDiscoveredFilters(supabase, id, overview.discovered_filters, items);
        }

        break;
      }

      case "researcher": {
        const prompt = `Collection: ${collection.name}
${collection.description ? `Description: ${collection.description}` : ""}

Here are the items in this collection with their attributes:

${itemsJson}

Analyze this collection and identify gaps, missing items, and recommendations.`;

        const researcherData = await generateStructuredData({
          model: CLAUDE_MODEL,
          schema: ResearcherSchema,
          system: RESEARCHER_SYSTEM_PROMPT,
          prompt,
          max_tokens: 2048,
        });

        overviewMarkdown = formatResearcherOutput(researcherData);
        break;
      }

      case "curator": {
        const prompt = `Collection: ${collection.name}
${collection.description ? `Description: ${collection.description}` : ""}

Here are the items in this collection with their attributes:

${itemsJson}

Analyze this collection for redundant or overlapping items. Reference specific attributes when explaining why items are redundant.`;

        const curatorData = await generateStructuredData({
          model: CLAUDE_MODEL,
          schema: CuratorSchema,
          system: CURATOR_SYSTEM_PROMPT,
          prompt,
          max_tokens: 2048,
        });

        overviewMarkdown = formatCuratorOutput(curatorData);
        break;
      }

      default:
        throw new Error(`Unknown ai_mode: ${collection.ai_mode}`);
    }

    // Step 6: Store in database (as markdown string for all modes)
    const { error: updateError } = await (supabase as any)
      .from("collections")
      .update({
        ai_overview: overviewMarkdown,
        ai_overview_generated_at: new Date().toISOString(),
        ai_overview_model: CLAUDE_MODEL,
        ai_overview_valid: true,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to save overview:", updateError);
      return NextResponse.json(
        { error: "Failed to save overview" },
        { status: 500 }
      );
    }

    // Step 7: Return result
    return NextResponse.json({
      success: true,
      cached: false,
      overview: overviewMarkdown,
      generated_at: new Date().toISOString(),
      model: CLAUDE_MODEL,
      has_custom_prompt: !!collection.custom_prompt,
      ai_mode: collection.ai_mode,
      filter_processing: filterResult,
    });
  } catch (error) {
    console.error("Overview generation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

type CollectionAttributeSchemaInsert = Database["public"]["Tables"]["collection_attribute_schemas"]["Insert"];

/**
 * Process discovered filters from AI overview
 * - Upserts schemas into collection_attribute_schemas
 * - Extracts values from items and populates item_attributes
 *
 * Returns summary of what was processed for debugging
 */
async function processDiscoveredFilters(
  supabase: ReturnType<typeof getServiceRoleClient>,
  collectionId: string,
  discoveredFilters: DiscoveredFilter[],
  items: ItemWithCollectionMetadata[]
): Promise<{ processed: string[]; failed: Array<{ name: string; error: string }> }> {
  const processed: string[] = [];
  const failed: Array<{ name: string; error: string }> = [];

  for (const filter of discoveredFilters) {
    try {
      // Prepare schema data for upsert
      const schemaData: CollectionAttributeSchemaInsert = {
        collection_id: collectionId,
        name: filter.name,
        display_name: filter.display_name,
        description: filter.description || null,
        source_path: filter.source_path,
        value_type: filter.value_type as 'string' | 'number' | 'numeric_range',
        sample_values: filter.sample_values,
        item_coverage: filter.item_coverage,
        discovery_confidence: filter.usefulness_score,
        // Auto-show high confidence filters (>=0.7)
        is_visible: filter.usefulness_score >= 0.7,
      };

      console.log(`[Filter] Upserting schema: ${filter.name}`, JSON.stringify(schemaData));

      // Upsert the schema
      const { data: schema, error: schemaError } = await (supabase as any)
        .from("collection_attribute_schemas")
        .upsert(schemaData, {
          onConflict: "collection_id,name",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (schemaError) {
        const errorMsg = `Upsert failed: ${schemaError.code} - ${schemaError.message}`;
        console.error(`[Filter] ${filter.name}: ${errorMsg}`, schemaError);
        failed.push({ name: filter.name, error: errorMsg });
        continue;
      }

      console.log(`[Filter] Schema upserted: ${filter.name}, id=${schema.id}`);

      // Extract attributes from items for this schema
      const attributes = extractDynamicAttributesForItems(
        items.map((item) => ({
          id: item.id,
          attributes: item.attributes as Record<string, unknown>,
        })),
        {
          id: schema.id,
          name: filter.name,
          source_path: filter.source_path,
          value_type: filter.value_type,
        }
      );

      console.log(`[Filter] ${filter.name}: Extracted ${attributes.length} attributes from ${items.length} items`);

      if (attributes.length === 0) {
        console.warn(`[Filter] ${filter.name}: No attributes extracted - items may not have ${filter.source_path}`);
        processed.push(filter.name);
        continue;
      }

      // Delete existing attributes for this schema to avoid duplicates
      const { error: deleteError } = await (supabase as any)
        .from("item_attributes")
        .delete()
        .eq("collection_schema_id", schema.id);

      if (deleteError) {
        console.error(`[Filter] ${filter.name}: Delete existing failed:`, deleteError);
      }

      // Insert new attributes
      const { error: insertError } = await (supabase as any)
        .from("item_attributes")
        .insert(attributes);

      if (insertError) {
        const errorMsg = `Insert attributes failed: ${insertError.code} - ${insertError.message}`;
        console.error(`[Filter] ${filter.name}: ${errorMsg}`, insertError);
        failed.push({ name: filter.name, error: errorMsg });
        continue;
      }

      console.log(`[Filter] ${filter.name}: Successfully processed`);
      processed.push(filter.name);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Filter] ${filter.name}: Exception:`, err);
      failed.push({ name: filter.name, error: errorMsg });
    }
  }

  console.log(`[Filter] Summary: ${processed.length} processed, ${failed.length} failed`);
  if (failed.length > 0) {
    console.error(`[Filter] Failed filters:`, failed);
  }

  return { processed, failed };
}

/**
 * Format standard overview to Markdown
 */
function formatStandardOverview(overview: CollectionOverview): string {
  let markdown = `# Collection Overview\n\n`;
  markdown += `${overview.summary}\n\n`;

  if (overview.themes && overview.themes.length > 0) {
    markdown += `## Themes\n\n`;
    for (const theme of overview.themes) {
      markdown += `- ${theme}\n`;
    }
    markdown += `\n`;
  }

  if (overview.insights && overview.insights.length > 0) {
    markdown += `## Insights\n\n`;
    for (const insight of overview.insights) {
      markdown += `### ${insight.title}\n`;
      markdown += `${insight.description}\n\n`;
    }
  }

  return markdown;
}
