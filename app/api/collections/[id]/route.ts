import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface CollectionResponse {
  success: boolean;
  data?: Collection;
  error?: string;
}

interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  type?: string;
}

// GET /api/collections/[id] - Get a specific collection
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServerClient();

    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Failed to fetch collection:", error);
      return NextResponse.json(
        { success: false, error: error.message } as CollectionResponse,
        { status: error.code === "PGRST116" ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    } as CollectionResponse);
  } catch (error) {
    console.error("Error fetching collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as CollectionResponse,
      { status: 500 }
    );
  }
}

// PATCH /api/collections/[id] - Update a collection
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json() as UpdateCollectionRequest;

    // Validate that at least one field is being updated
    if (!body.name && !body.description && !body.type) {
      return NextResponse.json(
        { success: false, error: "No fields to update" } as CollectionResponse,
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    const updateData: Partial<Database["public"]["Tables"]["collections"]["Update"]> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) updateData.type = body.type;

    const { data, error } = await supabase
      .from("collections")
      // @ts-expect-error - Supabase type inference issue
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update collection:", error);
      return NextResponse.json(
        { success: false, error: error.message } as CollectionResponse,
        { status: error.code === "PGRST116" ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    } as CollectionResponse);
  } catch (error) {
    console.error("Error updating collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as CollectionResponse,
      { status: 500 }
    );
  }
}

// DELETE /api/collections/[id] - Delete a collection
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServerClient();

    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete collection:", error);
      return NextResponse.json(
        { success: false, error: error.message } as CollectionResponse,
        { status: error.code === "PGRST116" ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
    } as CollectionResponse);
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as CollectionResponse,
      { status: 500 }
    );
  }
}
