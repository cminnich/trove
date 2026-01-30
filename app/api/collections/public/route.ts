import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface PublicCollectionData {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  visibility: "public";
  fork_count: number;
  star_count: number;
  is_forkable: boolean;
  created_at: string;
  owner_username: string;
  item_count: number;
  thumbnail_urls: string[];
}

interface PublicCollectionResponse {
  success: boolean;
  data?: PublicCollectionData[];
  total?: number;
  error?: string;
}

// GET /api/collections/public - List all public collections with attribution
// Accessible to anonymous users (no auth required)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Use service role client - this is a public endpoint
    // RLS policy allows visibility='public' reads for anonymous users
    const supabase = getServiceRoleClient();

    // Fetch public collections with owner profile
    // Sort by star_count descending (most popular first), then fork_count, then by created_at
    const { data: collections, error, count } = await supabase
      .from("collections")
      .select(`
        *,
        profiles!collections_owner_id_fkey(username, email)
      `, { count: "exact" })
      .eq("visibility", "public")
      .order("star_count", { ascending: false })
      .order("fork_count", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Failed to fetch public collections:", error);
      return NextResponse.json(
        { success: false, error: error.message } as PublicCollectionResponse,
        { status: 500 }
      );
    }

    // Type the collections result
    type CollectionWithProfile = Collection & {
      profiles: { username: string | null; email: string | null } | null;
    };

    // For each collection, fetch item count and first 4 thumbnails
    const collectionsWithMetadata = await Promise.all(
      (collections as CollectionWithProfile[]).map(async (collection) => {
        // Fetch thumbnails
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
        const { count: itemCount } = await supabase
          .from("collection_items")
          .select("*", { count: "exact", head: true })
          .eq("collection_id", collection.id);

        // Compute owner_username without exposing email or owner_id
        const ownerUsername =
          collection.profiles?.username ||
          collection.profiles?.email?.split("@")[0] ||
          "unknown";

        // Map to public-safe data structure
        // CRITICAL: Do NOT include owner_id (privacy)
        const publicData: PublicCollectionData = {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          type: collection.type,
          visibility: "public",
          fork_count: collection.fork_count,
          star_count: collection.star_count || 0,
          is_forkable: collection.is_forkable,
          created_at: collection.created_at,
          owner_username: ownerUsername,
          item_count: itemCount || 0,
          thumbnail_urls: thumbnails,
        };

        return publicData;
      })
    );

    return NextResponse.json({
      success: true,
      data: collectionsWithMetadata,
      total: count || 0,
    } as PublicCollectionResponse);
  } catch (error) {
    console.error("Error fetching public collections:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as PublicCollectionResponse,
      { status: 500 }
    );
  }
}
