import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase-server";
import { loadPrompt, replaceVars, callClaudeJSON } from "@/lib/ai";
import {
  CollectionOverviewSchema,
  type CollectionOverview,
} from "@/types/collection-overview";
import type { Database } from "@/types/database";

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
      });
    }

    return NextResponse.json({
      success: true,
      overview: JSON.parse(collection.ai_overview),
      generated_at: collection.ai_overview_generated_at,
      model: collection.ai_overview_model,
      needs_generation: false,
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
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Step 2: Check if overview is already valid
    if (collection.ai_overview_valid && collection.ai_overview) {
      return NextResponse.json({
        success: true,
        cached: true,
        overview: JSON.parse(collection.ai_overview),
        generated_at: collection.ai_overview_generated_at,
        model: collection.ai_overview_model,
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
    const promptTemplate = loadPrompt("collection_overview.txt");
    const prompt = replaceVars(promptTemplate, {
      COLLECTION_NAME: collection.name,
      COLLECTION_DESCRIPTION: collection.description || "No description provided",
      COLLECTION_TYPE: collection.type || "General",
      ITEM_COUNT: items.length.toString(),
      ITEMS_JSON: JSON.stringify(items, null, 2),
    });

    const { data: overview } = await callClaudeJSON<CollectionOverview>(
      prompt,
      {
        model: CLAUDE_MODEL,
        max_tokens: 2048,
      }
    );

    // Validate with Zod
    const validated = CollectionOverviewSchema.parse(overview);

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

    // Step 6: Return result
    return NextResponse.json({
      success: true,
      cached: false,
      overview: validated,
      generated_at: new Date().toISOString(),
      model: CLAUDE_MODEL,
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
