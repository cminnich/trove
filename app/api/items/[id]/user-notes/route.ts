import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";

interface UpdateUserNotesRequest {
  notes: string;
  collection_ids: string[];
}

interface UpdateUserNotesResponse {
  success: boolean;
  data?: {
    updated_count: number;
    collection_ids: string[];
  };
  error?: string;
}

// PATCH /api/items/[id]/user-notes - Update notes across multiple user collections
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
    const body: UpdateUserNotesRequest = await req.json();

    // Validate request body
    if (typeof body.notes !== "string") {
      return NextResponse.json(
        { success: false, error: "notes must be a string" } as UpdateUserNotesResponse,
        { status: 400 }
      );
    }

    if (!Array.isArray(body.collection_ids) || body.collection_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "collection_ids must be a non-empty array" } as UpdateUserNotesResponse,
        { status: 400 }
      );
    }

    // Get authenticated user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as UpdateUserNotesResponse,
        { status: 401 }
      );
    }

    // First, verify that all specified collections are owned by this user
    const { data: collections, error: collectionsError } = await client
      .from("collections")
      .select("id")
      .in("id", body.collection_ids)
      .eq("owner_id", user.id);

    if (collectionsError) {
      console.error("Failed to verify collection ownership:", collectionsError);
      return NextResponse.json(
        { success: false, error: collectionsError.message } as UpdateUserNotesResponse,
        { status: 500 }
      );
    }

    // Check if all requested collections are owned by the user
    const ownedCollectionIds = collections?.map((c) => c.id) || [];
    const unauthorizedCollections = body.collection_ids.filter(
      (id) => !ownedCollectionIds.includes(id)
    );

    if (unauthorizedCollections.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `You do not own the following collections: ${unauthorizedCollections.join(", ")}`,
        } as UpdateUserNotesResponse,
        { status: 403 }
      );
    }

    // Update notes for all specified collections
    const { error: updateError } = await client
      .from("collection_items")
      .update({ notes: body.notes })
      .eq("item_id", itemId)
      .in("collection_id", body.collection_ids);

    if (updateError) {
      console.error("Failed to update notes:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message } as UpdateUserNotesResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        updated_count: body.collection_ids.length,
        collection_ids: body.collection_ids,
      },
    } as UpdateUserNotesResponse);
  } catch (error) {
    console.error("Error updating user notes:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as UpdateUserNotesResponse,
      { status: 500 }
    );
  }
}
