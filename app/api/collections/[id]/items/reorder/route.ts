import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

interface ReorderRequest {
  itemPositions: Array<{ item_id: string; position: number }>;
}

interface ReorderResponse {
  success: boolean;
  error?: string;
}

// PATCH /api/collections/[id]/items/reorder - Update positions for multiple items
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collection_id } = await params;
    const body = await req.json() as ReorderRequest;

    if (!body.itemPositions || !Array.isArray(body.itemPositions)) {
      return NextResponse.json(
        { success: false, error: "itemPositions array is required" } as ReorderResponse,
        { status: 400 }
      );
    }

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ReorderResponse,
        { status: 401 }
      );
    }

    // Verify user has write access to this collection
    const { data: collection, error: accessError } = await client
      .from("collections")
      .select("id")
      .eq("id", collection_id)
      .single();

    if (accessError || !collection) {
      return NextResponse.json(
        { success: false, error: "Collection not found or access denied" } as ReorderResponse,
        { status: 404 }
      );
    }

    // Use authenticated client - RLS enforces write permissions
    const supabase = client;

    // Update each item's position
    // Note: We do this in a loop since Supabase doesn't support batch updates with different values
    // For better performance with many items, consider using a Postgres function
    const updates = body.itemPositions.map(async ({ item_id, position }) => {
      // Type assertion needed: Supabase TypeScript has issues with composite primary keys
      const { error } = await (supabase as any)
        .from("collection_items")
        .update({ position })
        .eq("collection_id", collection_id)
        .eq("item_id", item_id);

      if (error) {
        throw error;
      }
    });

    // Wait for all updates to complete
    await Promise.all(updates);

    return NextResponse.json({
      success: true,
    } as ReorderResponse);
  } catch (error) {
    console.error("Error reordering items:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ReorderResponse,
      { status: 500 }
    );
  }
}
