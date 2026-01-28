import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient, getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Item = Database["public"]["Tables"]["items"]["Row"];

interface ItemResponse {
  success: boolean;
  data?: Item;
  error?: string;
}

// GET /api/items/[id] - Get a single item
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Failed to fetch item:", error);
      return NextResponse.json(
        { success: false, error: error.message } as ItemResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    } as ItemResponse);
  } catch (error) {
    console.error("Error fetching item:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ItemResponse,
      { status: 500 }
    );
  }
}

// PATCH /api/items/[id] - Update item fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Allowed fields to update
    const allowedFields = ["category", "tags", "item_type", "image_url", "price", "currency"];
    const updateData: Partial<Item> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field as keyof Item] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" } as ItemResponse,
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // Type assertion needed for Supabase TypeScript compatibility
    const { data, error } = await (supabase as any)
      .from("items")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update item:", error);
      return NextResponse.json(
        { success: false, error: error.message } as ItemResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    } as ItemResponse);
  } catch (error) {
    console.error("Error updating item:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ItemResponse,
      { status: 500 }
    );
  }
}

interface TrashItemResponse {
  success: boolean;
  data?: {
    item_id: string;
    removed_from_collections: string[];
  };
  error?: string;
}

// DELETE /api/items/[id] - Move item to trash (remove from ALL collections)
// The item is not actually deleted from the database, just orphaned
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;

    // Get authenticated user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as TrashItemResponse,
        { status: 401 }
      );
    }

    // First, verify the item exists
    const supabase = getServiceRoleClient();
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id")
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { success: false, error: "Item not found" } as TrashItemResponse,
        { status: 404 }
      );
    }

    // Get all collections this item belongs to (owned by this user)
    const { data: userCollections, error: collectionsError } = await client
      .from("collection_items")
      .select("collection_id, collections!inner(owner_id, name)")
      .eq("item_id", itemId)
      .eq("collections.owner_id", user.id);

    if (collectionsError) {
      console.error("Failed to fetch user collections for item:", collectionsError);
      return NextResponse.json(
        { success: false, error: collectionsError.message } as TrashItemResponse,
        { status: 500 }
      );
    }

    if (!userCollections || userCollections.length === 0) {
      return NextResponse.json(
        { success: false, error: "Item is not in any of your collections" } as TrashItemResponse,
        { status: 400 }
      );
    }

    // Remove item from ALL user's collections
    const collectionIds = userCollections.map(uc => {
      const typedUC = uc as { collection_id: string; collections: { owner_id: string; name: string } };
      return typedUC.collection_id;
    });

    const { error: deleteError } = await client
      .from("collection_items")
      .delete()
      .eq("item_id", itemId)
      .in("collection_id", collectionIds);

    if (deleteError) {
      console.error("Failed to remove item from collections:", deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message } as TrashItemResponse,
        { status: 500 }
      );
    }

    // Invalidate AI overviews for affected collections
    await (client as any)
      .from("collections")
      .update({ ai_overview_valid: false })
      .in("id", collectionIds);

    return NextResponse.json({
      success: true,
      data: {
        item_id: itemId,
        removed_from_collections: collectionIds,
      },
    } as TrashItemResponse);
  } catch (error) {
    console.error("Error trashing item:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as TrashItemResponse,
      { status: 500 }
    );
  }
}
