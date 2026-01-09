import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];
type CollectionItem = Database["public"]["Tables"]["collection_items"]["Row"];

interface UserCollectionWithMetadata extends Collection {
  notes: string | null;
  position: number | null;
}

interface UserCollectionsResponse {
  success: boolean;
  data?: UserCollectionWithMetadata[];
  error?: string;
}

// GET /api/items/[id]/user-collections - Get all user's collections containing this item
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;

    // Get authenticated user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as UserCollectionsResponse,
        { status: 401 }
      );
    }

    // Fetch all collections owned by this user that contain the specified item
    const { data, error } = await client
      .from("collections")
      .select(`
        *,
        collection_items!inner(notes, position)
      `)
      .eq("owner_id", user.id)
      .eq("collection_items.item_id", itemId);

    if (error) {
      console.error("Failed to fetch user collections:", error);
      return NextResponse.json(
        { success: false, error: error.message } as UserCollectionsResponse,
        { status: 500 }
      );
    }

    // Transform the data to flatten collection_items fields
    const userCollections: UserCollectionWithMetadata[] = (data as any[]).map((row) => {
      const collectionItems = row.collection_items;
      const notes = Array.isArray(collectionItems)
        ? collectionItems[0]?.notes ?? null
        : collectionItems?.notes ?? null;
      const position = Array.isArray(collectionItems)
        ? collectionItems[0]?.position ?? null
        : collectionItems?.position ?? null;

      // Remove the nested collection_items and add flattened fields
      const { collection_items, ...collection } = row;
      return {
        ...collection,
        notes,
        position,
      };
    });

    return NextResponse.json({
      success: true,
      data: userCollections,
    } as UserCollectionsResponse);
  } catch (error) {
    console.error("Error fetching user collections:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as UserCollectionsResponse,
      { status: 500 }
    );
  }
}
