import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Collection = Database["public"]["Tables"]["collections"]["Row"];

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

    const supabase = getServerClient();

    // Fetch collection to check visibility
    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .single();

    if (collectionError) {
      console.error("Failed to fetch collection:", collectionError);
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

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

    // Generate Markdown + JSON hybrid format
    const contextMarkdown = generateContextMarkdown(collection, items);

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
 * 2. Items list with **Tier 4 User Notes** most prominent
 * 3. Embedded JSON for each item with full metadata
 *
 * @param collection Collection metadata
 * @param items Items with collection-specific context
 * @returns Markdown string
 */
function generateContextMarkdown(
  collection: Collection,
  items: ItemWithCollectionMetadata[]
): string {
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

  // Items section
  lines.push("## Items");
  lines.push("");

  if (items.length === 0) {
    lines.push("*This collection is empty.*");
  } else {
    items.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.title}`);
      lines.push("");

      // **TIER 4: USER NOTES** - Most prominent for AI understanding
      if (item.notes) {
        lines.push(`**📝 Context:** ${item.notes}`);
        lines.push("");
      }

      // Tier 1: Librarian (item_type)
      lines.push(`**Type:** ${item.item_type}`);

      // Tier 2: Department (category)
      if (item.category) {
        lines.push(`**Category:** ${item.category}`);
      }

      // Tier 3: Traits (tags)
      if (item.tags && item.tags.length > 0) {
        lines.push(`**Tags:** ${item.tags.join(", ")}`);
      }

      // Product details
      if (item.brand) {
        lines.push(`**Brand:** ${item.brand}`);
      }

      if (item.price !== null) {
        const currency = item.currency || "USD";
        lines.push(`**Price:** ${currency} ${item.price.toFixed(2)}`);
      }

      if (item.retailer) {
        lines.push(`**Retailer:** ${item.retailer}`);
      }

      if (item.source_url) {
        lines.push(`**URL:** ${item.source_url}`);
      }

      if (item.image_url) {
        lines.push(`**Image:** ${item.image_url}`);
      }

      lines.push("");

      // Embedded JSON with full metadata
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
  lines.push("- **Structured metadata** is available in both human-readable and JSON formats");
  lines.push("- **4-Tier Hierarchy:** Item Type → Category → Tags → User Context");
  lines.push("");
  lines.push(`*Generated by Trove on ${new Date().toISOString()}*`);

  return lines.join("\n");
}
