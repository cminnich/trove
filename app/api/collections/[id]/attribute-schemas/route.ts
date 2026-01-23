import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type CollectionAttributeSchema = Database["public"]["Tables"]["collection_attribute_schemas"]["Row"];

interface AttributeSchemasResponse {
  success: boolean;
  data?: CollectionAttributeSchema[];
  error?: string;
}

/**
 * GET /api/collections/[id]/attribute-schemas
 * List all AI-discovered attribute schemas for a collection
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as AttributeSchemasResponse,
        { status: 401 }
      );
    }

    const supabase = getServiceRoleClient();

    // Fetch all schemas for this collection
    const { data, error } = await supabase
      .from("collection_attribute_schemas")
      .select("*")
      .eq("collection_id", collectionId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch collection schemas:", error);
      return NextResponse.json(
        { success: false, error: error.message } as AttributeSchemasResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as CollectionAttributeSchema[],
    } as AttributeSchemasResponse);
  } catch (error) {
    console.error("Error fetching collection schemas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as AttributeSchemasResponse,
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/collections/[id]/attribute-schemas
 * Update a schema's visibility or display order
 * Body: { schema_id: string, is_visible?: boolean, display_order?: number }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const body = await req.json();
    const { schema_id, is_visible, display_order } = body;

    if (!schema_id) {
      return NextResponse.json(
        { success: false, error: "schema_id is required" } as AttributeSchemasResponse,
        { status: 400 }
      );
    }

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as AttributeSchemasResponse,
        { status: 401 }
      );
    }

    const supabase = getServiceRoleClient();

    // Verify schema belongs to this collection
    const { data: existingSchema, error: fetchError } = await supabase
      .from("collection_attribute_schemas")
      .select("id")
      .eq("id", schema_id)
      .eq("collection_id", collectionId)
      .single();

    if (fetchError || !existingSchema) {
      return NextResponse.json(
        { success: false, error: "Schema not found" } as AttributeSchemasResponse,
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (typeof is_visible === "boolean") {
      updateData.is_visible = is_visible;
    }
    if (typeof display_order === "number") {
      updateData.display_order = display_order;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" } as AttributeSchemasResponse,
        { status: 400 }
      );
    }

    // Update the schema
    const { error: updateError } = await (supabase as any)
      .from("collection_attribute_schemas")
      .update(updateData)
      .eq("id", schema_id);

    if (updateError) {
      console.error("Failed to update schema:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message } as AttributeSchemasResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating collection schema:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as AttributeSchemasResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/collections/[id]/attribute-schemas
 * Delete a schema and its associated item_attributes
 * Query: ?schema_id=<uuid>
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const { searchParams } = new URL(req.url);
    const schemaId = searchParams.get("schema_id");

    if (!schemaId) {
      return NextResponse.json(
        { success: false, error: "schema_id is required" } as AttributeSchemasResponse,
        { status: 400 }
      );
    }

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as AttributeSchemasResponse,
        { status: 401 }
      );
    }

    const supabase = getServiceRoleClient();

    // Verify schema belongs to this collection
    const { data: existingSchema, error: fetchError } = await supabase
      .from("collection_attribute_schemas")
      .select("id")
      .eq("id", schemaId)
      .eq("collection_id", collectionId)
      .single();

    if (fetchError || !existingSchema) {
      return NextResponse.json(
        { success: false, error: "Schema not found" } as AttributeSchemasResponse,
        { status: 404 }
      );
    }

    // Delete the schema (item_attributes will cascade delete due to FK constraint)
    const { error: deleteError } = await supabase
      .from("collection_attribute_schemas")
      .delete()
      .eq("id", schemaId);

    if (deleteError) {
      console.error("Failed to delete schema:", deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message } as AttributeSchemasResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection schema:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as AttributeSchemasResponse,
      { status: 500 }
    );
  }
}
