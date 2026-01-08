import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
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
    const supabase = getServerClient();

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
    const allowedFields = ["category", "tags", "item_type"];
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

    const supabase = getServerClient();

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
