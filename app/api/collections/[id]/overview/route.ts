import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase-server";
import { loadPrompt, replaceVars, callClaudeJSON } from "@/lib/ai";
import {
  CollectionOverviewSchema,
  REQUIRED_SCHEMA_SUFFIX,
  type CollectionOverview,
  type DiscoveredFilter,
} from "@/types/collection-overview";
import type { Database } from "@/types/database";
import { extractDynamicAttributesForItems } from "@/lib/attribute-normalizer";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

type Collection = Database["public"]["Tables"]["collections"]["Row"];
type Item = Database["public"]["Tables"]["items"]["Row"];

interface ItemWithCollectionMetadata extends Item {
  collection_notes: string | null;
  collection_position: number | null;
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

    // Type assertion needed due to Supabase client type inference limitations
    const collection = data as Collection;

    if (!collection.ai_overview_valid || !collection.ai_overview) {
      return NextResponse.json({
        success: true,
        overview: null,
        needs_generation: true,
        has_custom_prompt: !!collection.custom_prompt,
      });
    }

    return NextResponse.json({
      success: true,
      overview: JSON.parse(collection.ai_overview),
      generated_at: collection.ai_overview_generated_at,
      model: collection.ai_overview_model,
      needs_generation: false,
      has_custom_prompt: !!collection.custom_prompt,
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

    // Type assertion needed due to Supabase client type inference limitations
    const collection = collectionData as Collection;

    // Handle reprocess_filters mode: skip AI, just reprocess from existing overview
    if (reprocessFilters) {
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
        overview: JSON.parse(collection.ai_overview),
        generated_at: collection.ai_overview_generated_at,
        model: collection.ai_overview_model,
        has_custom_prompt: !!collection.custom_prompt,
      });
    }

    // Step 3: Fetch items in collection
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

    // Step 4: Generate AI overview
    // Use custom_prompt if defined, otherwise use default template
    // Append required schema suffix to custom prompts ONLY if not already present
    const isCustomPrompt = !!collection.custom_prompt;
    const baseTemplate = collection.custom_prompt || loadPrompt("collection_overview.txt");

    // Check if custom prompt already contains schema instructions (avoid duplicate context)
    // Look for unique identifier phrases from REQUIRED_SCHEMA_SUFFIX
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
      ITEMS_JSON: JSON.stringify(items, null, 2),
    });

    const { data: overview, raw: rawResponse } = await callClaudeJSON<CollectionOverview>(
      prompt,
      {
        model: CLAUDE_MODEL,
        max_tokens: 2048,
      }
    );

    // Validate with Zod - the schema uses preprocess functions to auto-correct common AI mistakes
    let validated: CollectionOverview;
    try {
      validated = CollectionOverviewSchema.parse(overview);
    } catch (zodError) {
      // Log the raw response for debugging
      console.error("Zod validation failed. Raw AI response:", rawResponse);
      console.error("Parsed overview object:", JSON.stringify(overview, null, 2));
      throw zodError;
    }

    // Step 5: Store in database
    // Type assertion needed due to Supabase client type inference limitations
    const { error: updateError } = await (supabase as any)
      .from("collections")
      .update({
        ai_overview: JSON.stringify(validated),
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

    // Step 6: Process discovered filters (if any)
    let filterResult: { processed: string[]; failed: Array<{ name: string; error: string }> } | null = null;
    if (validated.discovered_filters && validated.discovered_filters.length > 0) {
      filterResult = await processDiscoveredFilters(supabase, id, validated.discovered_filters, items);
    }

    // Step 7: Return result
    return NextResponse.json({
      success: true,
      cached: false,
      overview: validated,
      generated_at: new Date().toISOString(),
      model: CLAUDE_MODEL,
      has_custom_prompt: !!collection.custom_prompt,
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
      // Type assertion needed due to Supabase client type inference limitations
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
      // Type assertion needed due to Supabase client type inference limitations
      const { error: deleteError } = await (supabase as any)
        .from("item_attributes")
        .delete()
        .eq("collection_schema_id", schema.id);

      if (deleteError) {
        console.error(`[Filter] ${filter.name}: Delete existing failed:`, deleteError);
      }

      // Insert new attributes
      // Type assertion needed due to Supabase client type inference limitations
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
