import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

/** Collection row plus API-only fields for list responses */
export interface CollectionWithMetadata extends Collection {
  thumbnail_urls: string[];
  item_count: number;
  /** Present when returned from GET /api/collections: 'owner' = owned by user, 'editor' = shared with edit */
  access_type?: "owner" | "editor";
}

interface CreateCollectionRequest {
  name: string;
  description?: string;
  type?: string;
}

interface CollectionResponse {
  success: boolean;
  data?: Collection | Collection[] | CollectionWithMetadata[];
  error?: string;
}

// Use service role for aggregations (bypasses RLS for performance)
async function addCollectionMetadata(
  supabase: ReturnType<typeof getServiceRoleClient>,
  collections: Collection[],
  access_type: "owner" | "editor"
): Promise<CollectionWithMetadata[]> {
  return Promise.all(
    collections.map(async (collection) => {
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
        ?.map((item: { items?: { image_url?: string } }) => item.items?.image_url)
        .filter((url): url is string => !!url) || [];

      const { count } = await supabase
        .from("collection_items")
        .select("*", { count: "exact", head: true })
        .eq("collection_id", collection.id);

      return {
        ...collection,
        thumbnail_urls: thumbnails,
        item_count: count || 0,
        access_type,
      };
    })
  );
}

// GET /api/collections - List collections user owns or can edit (shared with editor)
export async function GET() {
  try {
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as CollectionResponse,
        { status: 401 }
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Collections owned by this user
    const { data: owned, error: ownedError } = await client
      .from("collections")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (ownedError) {
      console.error("Failed to fetch owned collections:", ownedError);
      return NextResponse.json(
        { success: false, error: ownedError.message } as CollectionResponse,
        { status: 500 }
      );
    }

    const ownedList = (owned || []) as Collection[];

    // 2. Collections shared with this user with editor access
    const { data: accessRows } = await client
      .from("collection_access")
      .select("collection_id")
      .eq("user_id", user.id)
      .eq("access_level", "editor");

    const sharedIds = (accessRows || [])
      .map((r: { collection_id: string }) => r.collection_id)
      .filter((id: string) => !ownedList.some((c) => c.id === id)); // exclude if user also owns

    let sharedList: Collection[] = [];
    if (sharedIds.length > 0) {
      const { data: shared, error: sharedError } = await client
        .from("collections")
        .select("*")
        .in("id", sharedIds)
        .order("created_at", { ascending: false });

      if (!sharedError && shared) {
        sharedList = shared as Collection[];
      }
    }

    const ownedWithMeta = await addCollectionMetadata(supabase, ownedList, "owner");
    const sharedWithMeta = await addCollectionMetadata(supabase, sharedList, "editor");

    const collectionsWithMetadata: CollectionWithMetadata[] = [
      ...ownedWithMeta,
      ...sharedWithMeta,
    ];

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

    // Get user's default visibility preference from their profile
    const { data: profile } = await client
      .from("profiles")
      .select("default_visibility")
      .eq("id", user.id)
      .maybeSingle();

    // Default to 'public' if no preference is set
    type ProfileVisibility = Pick<Database["public"]["Tables"]["profiles"]["Row"], "default_visibility">;
    const defaultVisibility = (profile as ProfileVisibility | null)?.default_visibility || 'public';

    // Use database function to create collection with proper RLS context
    // This uses SECURITY DEFINER to bypass RLS while ensuring the user is authenticated
    // and owner_id is correctly set. This is the same pattern used for read operations
    // (user_can_read_collection, user_can_write_collection) in migration 005.
    const { data: collectionId, error: rpcError } = await (client as any).rpc(
      'create_user_collection',
      {
        collection_name: body.name,
        collection_description: body.description || null,
        collection_type: body.type || null,
        collection_visibility: defaultVisibility,
      }
    );

    if (rpcError) {
      console.error("Failed to create collection:", rpcError);
      return NextResponse.json(
        { success: false, error: rpcError.message } as CollectionResponse,
        { status: 500 }
      );
    }

    // Fetch the created collection to return full data
    const { data, error } = await client
      .from("collections")
      .select()
      .eq("id", collectionId)
      .single();

    if (error) {
      console.error("Failed to fetch created collection:", error);
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
