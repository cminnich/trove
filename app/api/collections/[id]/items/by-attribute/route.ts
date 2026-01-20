import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Item = Database["public"]["Tables"]["items"]["Row"];

interface ItemWithCollectionMetadata extends Item {
  added_at: string;
  position: number | null;
  notes: string | null;
}

interface FilteredItemsResponse {
  success: boolean;
  data?: {
    items: ItemWithCollectionMetadata[];
    total: number;
    group_key: string;
  };
  error?: string;
}

// GET /api/collections/[id]/items/by-attribute - Filter items by group_key
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const { searchParams } = new URL(req.url);
    const groupKey = searchParams.get("group_key");

    if (!groupKey) {
      return NextResponse.json(
        { success: false, error: "group_key is required" } as FilteredItemsResponse,
        { status: 400 }
      );
    }

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as FilteredItemsResponse,
        { status: 401 }
      );
    }

    // Verify user has access to this collection (RLS enforces this)
    const { data: collection, error: accessError } = await client
      .from("collections")
      .select("id")
      .eq("id", collectionId)
      .single();

    if (accessError || !collection) {
      return NextResponse.json(
        { success: false, error: "Collection not found or access denied" } as FilteredItemsResponse,
        { status: 404 }
      );
    }

    const supabase = getServiceRoleClient();

    // Get all item IDs in this collection that have the specified attribute
    const { data: matchingAttrsData, error: attrsError } = await supabase
      .from("item_attributes")
      .select("item_id")
      .eq("group_key", groupKey);

    if (attrsError) {
      console.error("Failed to fetch matching attributes:", attrsError);
      return NextResponse.json(
        { success: false, error: attrsError.message } as FilteredItemsResponse,
        { status: 500 }
      );
    }

    type AttrSelection = { item_id: string };
    const matchingAttrs = matchingAttrsData as AttrSelection[] | null;
    const matchingItemIds = new Set((matchingAttrs || []).map((a) => a.item_id));

    // Fetch items from collection
    const { data: collectionItems, error: itemsError } = await supabase
      .from("collection_items")
      .select(`
        added_at,
        position,
        notes,
        items (*)
      `)
      .eq("collection_id", collectionId);

    if (itemsError) {
      console.error("Failed to fetch collection items:", itemsError);
      return NextResponse.json(
        { success: false, error: itemsError.message } as FilteredItemsResponse,
        { status: 500 }
      );
    }

    // Filter to only items that match the attribute
    type CollectionItemWithItem = {
      added_at: string;
      position: number | null;
      notes: string | null;
      items: Item;
    };

    const filteredItems: ItemWithCollectionMetadata[] = (collectionItems as CollectionItemWithItem[])
      .filter((ci) => matchingItemIds.has(ci.items.id))
      .map((ci) => ({
        ...ci.items,
        added_at: ci.added_at,
        position: ci.position,
        notes: ci.notes,
      }));

    // Sort by position
    filteredItems.sort((a, b) => {
      if (a.position === null) return 1;
      if (b.position === null) return -1;
      return a.position - b.position;
    });

    return NextResponse.json({
      success: true,
      data: {
        items: filteredItems,
        total: filteredItems.length,
        group_key: groupKey,
      },
    } as FilteredItemsResponse);
  } catch (error) {
    console.error("Error filtering items by attribute:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as FilteredItemsResponse,
      { status: 500 }
    );
  }
}
