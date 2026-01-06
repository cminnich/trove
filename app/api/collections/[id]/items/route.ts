import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Item = Database["public"]["Tables"]["items"]["Row"];
type CollectionItem = Database["public"]["Tables"]["collection_items"]["Row"];

interface ItemWithCollectionMetadata extends Item {
  added_at: string;
  position: number | null;
  notes: string | null;
}

interface CollectionItemsResponse {
  success: boolean;
  data?: ItemWithCollectionMetadata[];
  error?: string;
}

interface AddItemRequest {
  item_id: string;
  position?: number;
  notes?: string;
}

interface AddItemResponse {
  success: boolean;
  data?: CollectionItem;
  error?: string;
}

// GET /api/collections/[id]/items - List all items in a collection
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServerClient();

    // Query items with collection metadata via JOIN
    const { data, error } = await supabase
      .from("collection_items")
      .select(`
        added_at,
        position,
        notes,
        items (*)
      `)
      .eq("collection_id", id)
      .order("position", { ascending: true, nullsFirst: false })
      .order("added_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch collection items:", error);
      return NextResponse.json(
        { success: false, error: error.message } as CollectionItemsResponse,
        { status: 500 }
      );
    }

    // Flatten the nested structure
    const items: ItemWithCollectionMetadata[] = data.map((ci) => {
      const item = ci.items as unknown as Item;
      return {
        ...item,
        added_at: ci.added_at,
        position: ci.position,
        notes: ci.notes,
      };
    });

    return NextResponse.json({
      success: true,
      data: items,
    } as CollectionItemsResponse);
  } catch (error) {
    console.error("Error fetching collection items:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as CollectionItemsResponse,
      { status: 500 }
    );
  }
}

// POST /api/collections/[id]/items - Add an existing item to a collection
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collection_id } = await params;
    const body = await req.json() as AddItemRequest;

    if (!body.item_id) {
      return NextResponse.json(
        { success: false, error: "item_id is required" } as AddItemResponse,
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    // Check if item already exists in collection
    const { data: existing } = await supabase
      .from("collection_items")
      .select("*")
      .eq("collection_id", collection_id)
      .eq("item_id", body.item_id)
      .single();

    if (existing) {
      // Item already in collection - update metadata instead
      const { data, error } = await supabase
        .from("collection_items")
        .update({
          position: body.position !== undefined ? body.position : existing.position,
          notes: body.notes !== undefined ? body.notes : existing.notes,
        })
        .eq("collection_id", collection_id)
        .eq("item_id", body.item_id)
        .select()
        .single();

      if (error) {
        console.error("Failed to update collection item:", error);
        return NextResponse.json(
          { success: false, error: error.message } as AddItemResponse,
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
      } as AddItemResponse);
    }

    // Add item to collection
    const { data, error } = await supabase
      .from("collection_items")
      .insert({
        collection_id,
        item_id: body.item_id,
        position: body.position,
        notes: body.notes,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to add item to collection:", error);
      return NextResponse.json(
        { success: false, error: error.message } as AddItemResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    } as AddItemResponse);
  } catch (error) {
    console.error("Error adding item to collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as AddItemResponse,
      { status: 500 }
    );
  }
}
