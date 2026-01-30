import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";
import type { CollectionOverview } from "@/types/collection-overview";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Collection = Database["public"]["Tables"]["collections"]["Row"];
type AttributeSchema = Database["public"]["Tables"]["attribute_schemas"]["Row"];
type CollectionFilterPreference = Database["public"]["Tables"]["collection_filter_preferences"]["Row"];

interface ItemWithCollectionMetadata extends Item {
  added_at: string;
  position: number | null;
  notes: string | null;
}

type CollectionItemWithItem = {
  added_at: string;
  position: number | null;
  notes: string | null;
  items: Item;
};

// Filter preference with joined schema data
interface FilterPreferenceWithSchema extends CollectionFilterPreference {
  attribute_schemas: AttributeSchema;
}

// Verbosity levels for context export
type VerbosityLevel = "basic" | "full";

// Core attribute names that map to direct item fields
const CORE_ATTRIBUTE_NAMES = [
  "item_type",
  "category",
  "tags",
  "brand",
  "price",
  "retailer",
] as const;

// Fields that can never be hidden
const PROTECTED_FIELDS = ["title", "notes"] as const;

/**
 * GET /api/v1/collections/[id]/context
 *
 * Public-facing, read-only endpoint that returns a collection's context
 * in a Markdown + JSON hybrid format optimized for LLM consumption.
 *
 * Privacy:
 * - Returns data ONLY if collection visibility is 'public'
 * - OR if a valid 'share_token' is provided in query params (future feature)
 *
 * Response Format:
 * - Human-readable Markdown with embedded JSON blobs
 * - 4-Tier Hierarchy with Tier 4 (User Notes) most prominent
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const shareToken = searchParams.get("share_token");
    const levelParam = searchParams.get("level");
    const level: VerbosityLevel = levelParam === "full" ? "full" : "basic";

    const supabase = getServiceRoleClient();

    // Fetch collection to check visibility
    const { data: collectionData, error: collectionError } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .single();

    if (collectionError || !collectionData) {
      console.error("Failed to fetch collection:", collectionError);
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const collection = collectionData as Collection;

    // Privacy check: Only allow access if collection is public
    // TODO: Add share_token validation when sharing feature is implemented (Phase 8/9)
    if (collection.visibility !== "public") {
      if (!shareToken) {
        return NextResponse.json(
          { error: "This collection is private. A valid share token is required." },
          { status: 403 }
        );
      }
      // TODO: Validate share_token against collection_access table
      // For now, reject all private collections without valid token
      return NextResponse.json(
        { error: "Invalid or expired share token" },
        { status: 403 }
      );
    }

    // Fetch items with collection metadata (including Tier 4 notes)
    const { data: collectionItems, error: itemsError } = await supabase
      .from("collection_items")
      .select(`
        added_at,
        position,
        notes,
        items (*)
      `)
      .eq("collection_id", id);

    if (itemsError) {
      console.error("Failed to fetch collection items:", itemsError);
      return NextResponse.json(
        { error: "Failed to fetch collection items" },
        { status: 500 }
      );
    }

    // Flatten and sort by position
    const items: ItemWithCollectionMetadata[] = (collectionItems as CollectionItemWithItem[])
      .map((ci) => ({
        ...ci.items,
        added_at: ci.added_at,
        position: ci.position,
        notes: ci.notes,
      }))
      .sort((a, b) => {
        if (a.position === null) return 1;
        if (b.position === null) return -1;
        return a.position - b.position;
      });

    // Fetch AI overview if valid (now stored as markdown string)
    let overview: string | null = null;
    if (collection.ai_overview_valid && collection.ai_overview) {
      overview = collection.ai_overview;
    }

    // Fetch collection filter preferences with attribute schemas
    const { data: filterPrefsData, error: filterPrefsError } = await supabase
      .from("collection_filter_preferences")
      .select(`
        *,
        attribute_schemas (*)
      `)
      .eq("collection_id", id);

    if (filterPrefsError) {
      console.error("Failed to fetch filter preferences:", filterPrefsError);
      // Non-fatal: continue without preferences
    }

    const filterPreferences = (filterPrefsData as FilterPreferenceWithSchema[] | null) || [];

    // Generate Markdown + JSON hybrid format
    const contextMarkdown = generateContextMarkdown(
      collection,
      items,
      overview,
      filterPreferences,
      level
    );

    // Return as plain text with markdown content type
    return new NextResponse(contextMarkdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error("Error generating context:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Generates Markdown + JSON hybrid format optimized for LLM consumption
 *
 * Structure:
 * 1. Collection metadata (name, description, item count)
 * 2. AI Curator's Analysis (if available)
 * 3. Items list with **Tier 4 User Notes** most prominent
 * 4. Embedded JSON for each item with full metadata (only in 'full' level)
 *
 * @param collection Collection metadata
 * @param items Items with collection-specific context
 * @param overview AI-generated collection overview (if available)
 * @param filterPreferences Collection filter preferences with schemas
 * @param level Verbosity level ('basic' or 'full')
 * @returns Markdown string
 */
function generateContextMarkdown(
  collection: Collection,
  items: ItemWithCollectionMetadata[],
  overview: CollectionOverview | null,
  filterPreferences: FilterPreferenceWithSchema[],
  level: VerbosityLevel
): string {
  // Build lookup maps for filter preferences
  // Map schema name to preference for quick lookup
  const preferencesBySchemaName = new Map<string, FilterPreferenceWithSchema>();
  for (const pref of filterPreferences) {
    if (pref.attribute_schemas?.name) {
      preferencesBySchemaName.set(pref.attribute_schemas.name, pref);
    }
  }

  // Helper to check if a core attribute should be hidden
  const isCoreAttributeHidden = (fieldName: string): boolean => {
    // Title and notes are protected - never hide them
    if ((PROTECTED_FIELDS as readonly string[]).includes(fieldName)) {
      return false;
    }
    const pref = preferencesBySchemaName.get(fieldName);
    return pref?.is_hidden === true;
  };

  // Helper to get extended attributes that should be shown (force_show = true)
  const getPromotedExtendedAttributes = (
    attributes: Record<string, unknown>
  ): Array<{ name: string; displayName: string; value: unknown }> => {
    const promoted: Array<{ name: string; displayName: string; value: unknown }> = [];

    for (const pref of filterPreferences) {
      if (pref.force_show && pref.attribute_schemas?.name) {
        const schemaName = pref.attribute_schemas.name;
        // Check if this attribute exists in the item's attributes JSON
        if (schemaName in attributes && attributes[schemaName] != null) {
          promoted.push({
            name: schemaName,
            displayName: pref.attribute_schemas.display_name || schemaName,
            value: attributes[schemaName],
          });
        }
      }
    }

    return promoted;
  };
  const lines: string[] = [];

  // Header
  lines.push(`# ${collection.name}`);
  lines.push("");

  if (collection.description) {
    lines.push(collection.description);
    lines.push("");
  }

  lines.push(`**Collection Type:** ${collection.type || "General"}`);
  lines.push(`**Item Count:** ${items.length}`);
  lines.push(`**Last Updated:** ${new Date(collection.updated_at).toLocaleDateString()}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // AI Curator's Analysis (if available)
  if (overview) {
    lines.push("## AI Curator's Analysis");
    lines.push("");
    lines.push(overview.summary);
    lines.push("");

    if (overview.themes && overview.themes.length > 0) {
      lines.push("**Key Themes:**");
      overview.themes.forEach((theme) => {
        lines.push(`- ${theme}`);
      });
      lines.push("");
    }

    if (overview.insights && overview.insights.length > 0) {
      lines.push("**Strategic Insights:**");
      overview.insights.forEach((insight) => {
        lines.push(`- **${insight.title}**: ${insight.description}`);
      });
      lines.push("");
    }

    if (overview.relationships && overview.relationships.length > 0) {
      lines.push("**Item Relationships:**");
      overview.relationships.forEach((rel) => {
        lines.push(
          `- *${rel.relationship_type}*: ${rel.description}`
        );
      });
      lines.push("");
    }

    lines.push(`*Confidence: ${(overview.confidence_score * 100).toFixed(0)}%*`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Items section
  lines.push("## Items");
  lines.push("");

  if (items.length === 0) {
    lines.push("*This collection is empty.*");
  } else {
    items.forEach((item, index) => {
      // Title is always shown (protected field)
      lines.push(`### ${index + 1}. ${item.title}`);
      lines.push("");

      // **TIER 4: USER NOTES** - Most prominent for AI understanding (protected field)
      if (item.notes) {
        lines.push(`**📝 Context:** ${item.notes}`);
        lines.push("");
      }

      // Tier 1: Librarian (item_type) - show unless hidden
      if (!isCoreAttributeHidden("item_type")) {
        lines.push(`**Type:** ${item.item_type}`);
      }

      // Tier 2: Department (category) - show unless hidden
      if (item.category && !isCoreAttributeHidden("category")) {
        lines.push(`**Category:** ${item.category}`);
      }

      // Tier 3: Traits (tags) - show unless hidden
      if (item.tags && item.tags.length > 0 && !isCoreAttributeHidden("tags")) {
        lines.push(`**Tags:** ${item.tags.join(", ")}`);
      }

      // Product details - show unless hidden
      if (item.brand && !isCoreAttributeHidden("brand")) {
        lines.push(`**Brand:** ${item.brand}`);
      }

      if (item.price !== null && !isCoreAttributeHidden("price")) {
        const currency = item.currency || "USD";
        lines.push(`**Price:** ${currency} ${item.price.toFixed(2)}`);
      }

      if (item.retailer && !isCoreAttributeHidden("retailer")) {
        lines.push(`**Retailer:** ${item.retailer}`);
      }

      if (item.source_url) {
        lines.push(`**URL:** ${item.source_url}`);
      }

      if (item.image_url) {
        lines.push(`**Image:** ${item.image_url}`);
      }

      // Extended Attributes: Show attributes with force_show=true
      const promotedAttributes = getPromotedExtendedAttributes(item.attributes || {});
      if (promotedAttributes.length > 0) {
        lines.push("");
        lines.push("**Extended Attributes:**");
        for (const attr of promotedAttributes) {
          const valueStr =
            typeof attr.value === "object"
              ? JSON.stringify(attr.value)
              : String(attr.value);
          lines.push(`- ${attr.displayName}: ${valueStr}`);
        }
      }

      lines.push("");

      // Embedded JSON with full metadata - only in 'full' level
      if (level === "full") {
        lines.push("```json");
        lines.push(
          JSON.stringify(
            {
              id: item.id,
              title: item.title,
              item_type: item.item_type,
              category: item.category,
              tags: item.tags,
              brand: item.brand,
              price: item.price,
              currency: item.currency,
              retailer: item.retailer,
              source_url: item.source_url,
              image_url: item.image_url,
              attributes: item.attributes,
              confidence_score: item.confidence_score,
              notes: item.notes, // Collection-specific context
              added_at: item.added_at,
            },
            null,
            2
          )
        );
        lines.push("```");
        lines.push("");
      }
    });
  }

  // Footer with usage instructions
  lines.push("---");
  lines.push("");
  lines.push("## How to Use This Context");
  lines.push("");
  lines.push("This collection has been formatted for AI agent consumption:");
  lines.push("");
  lines.push("- **User Notes (📝 Context)** provide the most important contextual information about why each item was saved");
  if (level === "full") {
    lines.push("- **Structured metadata** is available in both human-readable and JSON formats");
  } else {
    lines.push("- **Structured metadata** is available in human-readable format (use `?level=full` for JSON)");
  }
  lines.push("- **4-Tier Hierarchy:** Item Type → Category → Tags → User Context");
  lines.push("");
  lines.push(`*Generated by Trove on ${new Date().toISOString()} (level: ${level})*`);

  return lines.join("\n");
}
