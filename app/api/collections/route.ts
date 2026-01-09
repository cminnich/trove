import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface CreateCollectionRequest {
  name: string;
  description?: string;
  type?: string;
}

interface CollectionResponse {
  success: boolean;
  data?: Collection | Collection[];
  error?: string;
}

// GET /api/collections - List all collections with thumbnails and item counts
// Automatically ensures Inbox collection exists
export async function GET() {
  try {
    // Get authenticated user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as CollectionResponse,
        { status: 401 }
      );
    }

    // Ensure Inbox collection exists for this user
    const { data: existingInbox } = await client
      .from("collections")
      .select("id")
      .eq("owner_id", user.id)
      .eq("name", "Inbox")
      .eq("type", "inbox")
      .maybeSingle();

    if (!existingInbox) {
      // Create Inbox collection
      await client
        .from("collections")
        .insert({
          name: "Inbox",
          type: "inbox",
          description: "Default collection for new items",
          owner_id: user.id,
          visibility: "private",
        });
    }

    // Get all collections owned by this user
    const { data: collections, error } = await client
      .from("collections")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch collections:", error);
      return NextResponse.json(
        { success: false, error: error.message } as CollectionResponse,
        { status: 500 }
      );
    }

    // Use server client for aggregations (bypasses RLS for performance)
    const supabase = getServerClient();

    // For each collection, fetch item count and first 4 thumbnails
    const collectionsWithMetadata = await Promise.all(
      (collections as Collection[]).map(async (collection) => {
        const { data: items } = await supabase
          .from("collection_items")
          .select(`
            items!inner (
              image_url
            )
          `)
          .eq("collection_id", collection.id)
          .limit(4);

        const thumbnails = items
          ?.map((item: any) => item.items?.image_url)
          .filter((url): url is string => !!url) || [];

        // Get total item count
        const { count } = await supabase
          .from("collection_items")
          .select("*", { count: "exact", head: true })
          .eq("collection_id", collection.id);

        return {
          ...collection,
          thumbnail_urls: thumbnails,
          item_count: count || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: collectionsWithMetadata,
    } as CollectionResponse);
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as CollectionResponse,
      { status: 500 }
    );
  }
}

// POST /api/collections - Create a new collection
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CreateCollectionRequest;

    if (!body.name || body.name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Collection name is required" } as CollectionResponse,
        { status: 400 }
      );
    }

    // Get authenticated user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as CollectionResponse,
        { status: 401 }
      );
    }

    const insertData: Database["public"]["Tables"]["collections"]["Insert"] = {
      name: body.name,
      description: body.description,
      type: body.type,
      owner_id: user.id,
      visibility: 'private', // Default to private
    };

    const { data, error } = await client
      .from("collections")
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      console.error("Failed to create collection:", error);
      return NextResponse.json(
        { success: false, error: error.message } as CollectionResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    } as CollectionResponse);
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as CollectionResponse,
      { status: 500 }
    );
  }
}
