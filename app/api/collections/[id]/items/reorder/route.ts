import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
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

    const supabase = getServerClient();

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
