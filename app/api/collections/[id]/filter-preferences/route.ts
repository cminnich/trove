import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type FilterPreference = Database["public"]["Tables"]["collection_filter_preferences"]["Row"];
type AttributeSchema = Database["public"]["Tables"]["attribute_schemas"]["Row"];

interface FilterPreferenceWithSchema extends FilterPreference {
  schema: AttributeSchema;
}

interface FilterPreferencesResponse {
  success: boolean;
  data?: FilterPreferenceWithSchema[];
  error?: string;
}

interface SingleFilterPreferenceResponse {
  success: boolean;
  data?: FilterPreference;
  error?: string;
}

interface UpdateFilterPreferenceRequest {
  schema_id: string;
  is_hidden?: boolean;
  force_show?: boolean;
}

// GET /api/collections/[id]/filter-preferences - Get all filter preferences for a collection
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
        { success: false, error: "Unauthorized" } as FilterPreferencesResponse,
        { status: 401 }
      );
    }

    // Fetch filter preferences with schema info using RLS
    const { data, error } = await client
      .from("collection_filter_preferences")
      .select(`
        *,
        schema:attribute_schemas (*)
      `)
      .eq("collection_id", collectionId);

    if (error) {
      console.error("Failed to fetch filter preferences:", error);
      return NextResponse.json(
        { success: false, error: error.message } as FilterPreferencesResponse,
        { status: 500 }
      );
    }

    // Cast to proper type
    const preferences = data as unknown as FilterPreferenceWithSchema[] | null;

    return NextResponse.json({
      success: true,
      data: preferences || [],
    } as FilterPreferencesResponse);
  } catch (error) {
    console.error("Error fetching filter preferences:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as FilterPreferencesResponse,
      { status: 500 }
    );
  }
}

// POST /api/collections/[id]/filter-preferences - Create or update a filter preference
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const body = await req.json() as UpdateFilterPreferenceRequest;

    if (!body.schema_id) {
      return NextResponse.json(
        { success: false, error: "schema_id is required" } as SingleFilterPreferenceResponse,
        { status: 400 }
      );
    }

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as SingleFilterPreferenceResponse,
        { status: 401 }
      );
    }

    // Prepare upsert data
    type FilterPreferenceInsert = Database["public"]["Tables"]["collection_filter_preferences"]["Insert"];
    const insertData: FilterPreferenceInsert = {
      collection_id: collectionId,
      schema_id: body.schema_id,
      is_hidden: body.is_hidden ?? false,
      force_show: body.force_show ?? false,
    };

    // Upsert the preference (insert or update on conflict)
    const { data, error } = await (client as any)
      .from("collection_filter_preferences")
      .upsert(insertData, { onConflict: "collection_id,schema_id" })
      .select()
      .single();

    if (error) {
      console.error("Failed to upsert filter preference:", error);
      return NextResponse.json(
        { success: false, error: error.message } as SingleFilterPreferenceResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as FilterPreference,
    } as SingleFilterPreferenceResponse);
  } catch (error) {
    console.error("Error upserting filter preference:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as SingleFilterPreferenceResponse,
      { status: 500 }
    );
  }
}

// DELETE /api/collections/[id]/filter-preferences?schema_id=xxx - Delete a filter preference
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
        { success: false, error: "schema_id query parameter is required" } as SingleFilterPreferenceResponse,
        { status: 400 }
      );
    }

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as SingleFilterPreferenceResponse,
        { status: 401 }
      );
    }

    // Delete the preference
    const { error } = await client
      .from("collection_filter_preferences")
      .delete()
      .eq("collection_id", collectionId)
      .eq("schema_id", schemaId);

    if (error) {
      console.error("Failed to delete filter preference:", error);
      return NextResponse.json(
        { success: false, error: error.message } as SingleFilterPreferenceResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting filter preference:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as SingleFilterPreferenceResponse,
      { status: 500 }
    );
  }
}
