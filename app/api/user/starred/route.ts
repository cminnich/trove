import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface StarredCollectionData {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  visibility: string;
  fork_count: number;
  star_count: number;
  is_forkable: boolean;
  created_at: string;
  starred_at: string;
  owner_id: string | null;
  owner_username: string;
  item_count: number;
  thumbnail_urls: string[];
}

interface StarredCollectionsResponse {
  success: boolean;
  data?: StarredCollectionData[];
  error?: string;
}

// GET /api/user/starred - Get collections starred by current user
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as StarredCollectionsResponse,
        { status: 401 }
      );
    }

    // Query collection_stars joined with collections and profiles
    const { data: starredData, error } = await client
      .from("collection_stars")
      .select(`
        created_at,
        collections!inner (
          id, name, description, type, visibility, created_at, owner_id,
          fork_count, star_count, is_forkable,
          profiles!collections_owner_id_fkey (username, email)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch starred collections:", error);
      return NextResponse.json(
        { success: false, error: error.message } as StarredCollectionsResponse,
        { status: 500 }
      );
    }

    // Type the result (Supabase returns nested structure)
    type StarredRow = {
      created_at: string;
      collections: Collection & {
        profiles: { username: string | null; email: string | null } | null;
      };
    };

    // For each collection, fetch item count and thumbnails
    const collectionsWithMetadata = await Promise.all(
      ((starredData || []) as StarredRow[]).map(async (starredRow) => {
        const collection = starredRow.collections;

        // Fetch thumbnails
        const { data: items } = await client
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
        const { count: itemCount } = await client
          .from("collection_items")
          .select("*", { count: "exact", head: true })
          .eq("collection_id", collection.id);

        // Compute owner_username
        const ownerUsername =
          collection.profiles?.username ||
          collection.profiles?.email?.split("@")[0] ||
          "unknown";

        // Map to response structure
        const starredData: StarredCollectionData = {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          type: collection.type,
          visibility: collection.visibility,
          fork_count: collection.fork_count,
          star_count: collection.star_count || 0,
          is_forkable: collection.is_forkable,
          created_at: collection.created_at,
          starred_at: starredRow.created_at,
          owner_id: collection.owner_id,
          owner_username: ownerUsername,
          item_count: itemCount || 0,
          thumbnail_urls: thumbnails,
        };

        return starredData;
      })
    );

    return NextResponse.json({
      success: true,
      data: collectionsWithMetadata,
    } as StarredCollectionsResponse);
  } catch (error) {
    console.error("Error fetching starred collections:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as StarredCollectionsResponse,
      { status: 500 }
    );
  }
}
