import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
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
  visibility?: 'public' | 'private';
  ai_mode?: 'standard' | 'researcher' | 'curator';
  custom_prompt?: string | null;
  ai_overview_valid?: boolean;
}

// GET /api/collections/[id] - Get a specific collection
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as CollectionResponse,
        { status: 401 }
      );
    }

    // Query using authenticated client - RLS automatically enforces access control
    const { data, error } = await client
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
    // Note: custom_prompt can be null (to reset to default), so check for undefined
    if (!body.name && !body.description && !body.type && !body.visibility && !body.ai_mode && body.custom_prompt === undefined && body.ai_overview_valid === undefined) {
      return NextResponse.json(
        { success: false, error: "No fields to update" } as CollectionResponse,
        { status: 400 }
      );
    }

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as CollectionResponse,
        { status: 401 }
      );
    }

    const updateData: Partial<Database["public"]["Tables"]["collections"]["Update"]> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.visibility !== undefined) updateData.visibility = body.visibility;
    if (body.ai_mode !== undefined) {
      updateData.ai_mode = body.ai_mode;
      // Invalidate AI overview when mode changes (forces regeneration)
      updateData.ai_overview_valid = false;
    }
    if (body.custom_prompt !== undefined) updateData.custom_prompt = body.custom_prompt;
    if (body.ai_overview_valid !== undefined) updateData.ai_overview_valid = body.ai_overview_valid;

    // Query using authenticated client - RLS automatically enforces ownership
    const { data, error } = await ((client as any)
      .from("collections")
      .update(updateData)
      .eq("id", id)
      .select()
      .single());

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
// Orphan handling: Items only in this collection are moved to Inbox
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as CollectionResponse,
        { status: 401 }
      );
    }

    // Verify user owns this collection and it's not the Inbox
    const { data: collection, error: fetchError } = await client
      .from("collections")
      .select("id, owner_id, type, name")
      .eq("id", id)
      .single();

    if (fetchError || !collection) {
      return NextResponse.json(
        { success: false, error: "Collection not found" } as CollectionResponse,
        { status: 404 }
      );
    }

    const typedCollection = collection as { id: string; owner_id: string; type: string | null; name: string };

    if (typedCollection.owner_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to delete this collection" } as CollectionResponse,
        { status: 403 }
      );
    }

    // Prevent deletion of the Inbox collection
    if (typedCollection.type === "inbox") {
      return NextResponse.json(
        { success: false, error: "Cannot delete the Inbox collection" } as CollectionResponse,
        { status: 400 }
      );
    }

    // Find items that ONLY belong to this collection (orphans after deletion)
    // These items need to be moved to Inbox
    const { data: itemsInCollection, error: itemsError } = await client
      .from("collection_items")
      .select("item_id")
      .eq("collection_id", id);

    if (itemsError) {
      console.error("Failed to fetch items in collection:", itemsError);
      return NextResponse.json(
        { success: false, error: itemsError.message } as CollectionResponse,
        { status: 500 }
      );
    }

    // Fetch all collection IDs owned by this user once, to avoid per-item joins
    // that trigger ambiguous column references in RLS policies (collection_access.user_id).
    const { data: ownedCollectionsData, error: ownedCollectionsError } = await client
      .from("collections")
      .select("id")
      .eq("owner_id", user.id);

    if (ownedCollectionsError) {
      console.error("Failed to fetch owned collections:", ownedCollectionsError);
      return NextResponse.json(
        { success: false, error: ownedCollectionsError.message } as CollectionResponse,
        { status: 500 }
      );
    }

    const ownedCollectionIds: string[] = (ownedCollectionsData ?? []).map((c: { id: string }) => c.id);

    // Find which items would become orphans (only in this collection)
    const orphanItemIds: string[] = [];
    if (itemsInCollection && itemsInCollection.length > 0) {
      for (const item of itemsInCollection) {
        const typedItem = item as { item_id: string };
        // Check if this item exists in any OTHER collection owned by this user.
        const otherOwnedIds = ownedCollectionIds.filter(cId => cId !== id);
        let otherCollections: { collection_id: string }[] | null = [];
        if (otherOwnedIds.length > 0) {
          const { data: otherData, error: checkError } = await client
            .from("collection_items")
            .select("collection_id")
            .eq("item_id", typedItem.item_id)
            .in("collection_id", otherOwnedIds);

          if (checkError) {
            console.error("Failed to check other collections:", checkError);
            continue;
          }
          otherCollections = otherData as { collection_id: string }[] | null;
        }

        // If no other collections, this item will be orphaned
        if (!otherCollections || otherCollections.length === 0) {
          orphanItemIds.push(typedItem.item_id);
        }
      }
    }

    // If there are orphans, add them to the Inbox
    if (orphanItemIds.length > 0) {
      // Find Inbox collection (guaranteed to exist via database trigger in migration 017)
      const { data: inboxCollection, error: inboxFindError } = await client
        .from("collections")
        .select("id")
        .eq("owner_id", user.id)
        .eq("type", "inbox")
        .single();

      if (inboxFindError || !inboxCollection) {
        console.error("Failed to find Inbox collection:", inboxFindError);
        return NextResponse.json(
          { success: false, error: "Failed to find Inbox collection for orphaned items" } as CollectionResponse,
          { status: 500 }
        );
      }

      const inboxId = (inboxCollection as { id: string }).id;

      // Add orphan items to Inbox (these will be moved after collection deletion)
      // We need to insert before deletion because cascade will remove collection_items entries
      const orphanInserts = orphanItemIds.map(itemId => ({
        collection_id: inboxId,
        item_id: itemId,
        notes: null,
        position: null,
      }));

      const { error: insertError } = await (client as any)
        .from("collection_items")
        .upsert(orphanInserts, { onConflict: "collection_id,item_id" });

      if (insertError) {
        console.error("Failed to add orphan items to Inbox:", insertError);
        // Continue with deletion anyway - items will just become orphans
      }
    }

    // Now delete the collection (CASCADE will remove collection_items entries)
    const { error } = await client
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
      data: {
        orphan_items_moved_to_inbox: orphanItemIds.length,
      },
    });
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
