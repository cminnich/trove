import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface DeleteItemResponse {
  success: boolean;
  data?: {
    removed_from: string;
    added_to_inbox?: boolean;
    inbox_collection_id?: string;
  };
  error?: string;
}

// DELETE /api/collections/[id]/items/[itemId] - Remove item from collection with Inbox safety net
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: collectionId, itemId } = await params;

    // Get authenticated user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as DeleteItemResponse,
        { status: 401 }
      );
    }

    // Verify the user owns this collection
    const { data: collection, error: collectionError } = await client
      .from("collections")
      .select("id, owner_id, name")
      .eq("id", collectionId)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { success: false, error: "Collection not found" } as DeleteItemResponse,
        { status: 404 }
      );
    }

    // Type assertion needed for Supabase select with specific columns
    const typedCollection = collection as { id: string; owner_id: string; name: string };

    if (typedCollection.owner_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to modify this collection" } as DeleteItemResponse,
        { status: 403 }
      );
    }

    // Delete the item from the collection
    const { error: deleteError } = await client
      .from("collection_items")
      .delete()
      .eq("collection_id", collectionId)
      .eq("item_id", itemId);

    if (deleteError) {
      console.error("Failed to remove item from collection:", deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message } as DeleteItemResponse,
        { status: 500 }
      );
    }

    // Check if the item exists in any other collections owned by this user
    const { data: otherCollections, error: checkError } = await client
      .from("collection_items")
      .select("collection_id, collections!inner(owner_id)")
      .eq("item_id", itemId)
      .eq("collections.owner_id", user.id);

    if (checkError) {
      console.error("Failed to check other collections:", checkError);
      return NextResponse.json(
        { success: false, error: checkError.message } as DeleteItemResponse,
        { status: 500 }
      );
    }

    let addedToInbox = false;
    let inboxCollectionId: string | undefined;

    // If item doesn't exist in any other user collections, add to Inbox
    if (!otherCollections || otherCollections.length === 0) {
      // Find or create Inbox collection
      const { data: inboxCollection, error: inboxFindError } = await client
        .from("collections")
        .select("id")
        .eq("owner_id", user.id)
        .eq("name", "Inbox")
        .eq("type", "wishlist")
        .single();

      let inbox: Collection | null = inboxCollection;

      // Create Inbox if it doesn't exist
      if (inboxFindError || !inbox) {
        const { data: newInbox, error: inboxCreateError } = await client
          .from("collections")
          .insert({
            owner_id: user.id,
            name: "Inbox",
            description: "Default collection for items without a home",
            type: "wishlist",
            visibility: "private",
          } as any)
          .select()
          .single();

        if (inboxCreateError || !newInbox) {
          console.error("Failed to create Inbox collection:", inboxCreateError);
          return NextResponse.json(
            { success: false, error: "Failed to create Inbox collection" } as DeleteItemResponse,
            { status: 500 }
          );
        }

        inbox = newInbox;
      }

      // Ensure inbox is not null (TypeScript guard)
      if (!inbox) {
        return NextResponse.json(
          { success: false, error: "Failed to get or create Inbox collection" } as DeleteItemResponse,
          { status: 500 }
        );
      }

      // Add item to Inbox
      const { error: addToInboxError } = await client
        .from("collection_items")
        .insert({
          collection_id: (inbox as Collection).id,
          item_id: itemId,
          notes: null,
          position: null,
        } as any);

      if (addToInboxError) {
        console.error("Failed to add item to Inbox:", addToInboxError);
        return NextResponse.json(
          { success: false, error: "Failed to add item to Inbox" } as DeleteItemResponse,
          { status: 500 }
        );
      }

      addedToInbox = true;
      inboxCollectionId = (inbox as Collection).id;
    }

    return NextResponse.json({
      success: true,
      data: {
        removed_from: collectionId,
        added_to_inbox: addedToInbox,
        inbox_collection_id: inboxCollectionId,
      },
    } as DeleteItemResponse);
  } catch (error) {
    console.error("Error removing item from collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as DeleteItemResponse,
      { status: 500 }
    );
  }
}
