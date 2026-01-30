import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type StarInsert = Database["public"]["Tables"]["collection_stars"]["Insert"];
type Collection = Database["public"]["Tables"]["collection_stars"]["Row"];

interface StarResponse {
  isStarred: boolean;
  starCount: number;
  error?: string;
}

// GET /api/collections/[id]/star - Check if user has starred a collection
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;

    // Get client (may be unauthenticated)
    const { client, user } = await getAuthenticatedServerClient();

    // Get star count from collections table
    const { data: collection, error: collectionError } = await client
      .from("collections")
      .select("star_count")
      .eq("id", collectionId)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { isStarred: false, starCount: 0, error: "Collection not found" } as StarResponse,
        { status: 404 }
      );
    }

    const typedCollection = collection as { star_count: number | null };
    const starCount = typedCollection.star_count || 0;

    // If not authenticated, return not starred
    if (!user) {
      return NextResponse.json({
        isStarred: false,
        starCount,
      } as StarResponse);
    }

    // Check if user has starred this collection
    const { data: star } = await client
      .from("collection_stars")
      .select("id")
      .eq("user_id", user.id)
      .eq("collection_id", collectionId)
      .maybeSingle();

    return NextResponse.json({
      isStarred: !!star,
      starCount,
    } as StarResponse);
  } catch (error) {
    console.error("Error checking star status:", error);
    return NextResponse.json(
      {
        isStarred: false,
        starCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      } as StarResponse,
      { status: 500 }
    );
  }
}

// POST /api/collections/[id]/star - Toggle star status
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { isStarred: false, starCount: 0, error: "Unauthorized" } as StarResponse,
        { status: 401 }
      );
    }

    // Fetch collection to validate it exists and check ownership
    const { data: collection, error: collectionError } = await client
      .from("collections")
      .select("owner_id, star_count")
      .eq("id", collectionId)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { isStarred: false, starCount: 0, error: "Collection not found" } as StarResponse,
        { status: 404 }
      );
    }

    const typedCollection = collection as { owner_id: string; star_count: number | null };

    // Prevent starring own collection
    if (typedCollection.owner_id === user.id) {
      return NextResponse.json(
        { isStarred: false, starCount: typedCollection.star_count || 0, error: "Cannot star your own collection" } as StarResponse,
        { status: 403 }
      );
    }

    // Check if already starred
    const { data: existingStar } = await client
      .from("collection_stars")
      .select("id")
      .eq("user_id", user.id)
      .eq("collection_id", collectionId)
      .maybeSingle();

    let isStarred: boolean;

    if (existingStar) {
      // Unstar: Delete the row
      const { error: deleteError } = await client
        .from("collection_stars")
        .delete()
        .eq("user_id", user.id)
        .eq("collection_id", collectionId);

      if (deleteError) {
        console.error("Failed to unstar collection:", deleteError);
        return NextResponse.json(
          { isStarred: true, starCount: typedCollection.star_count || 0, error: "Failed to unstar collection" } as StarResponse,
          { status: 500 }
        );
      }

      isStarred = false;
    } else {
      // Star: Insert a row
      const insertData: StarInsert = {
        user_id: user.id,
        collection_id: collectionId,
      };

      const { error: insertError } = await (client as any)
        .from("collection_stars")
        .insert(insertData);

      if (insertError) {
        console.error("Failed to star collection:", insertError);
        return NextResponse.json(
          { isStarred: false, starCount: typedCollection.star_count || 0, error: "Failed to star collection" } as StarResponse,
          { status: 500 }
        );
      }

      isStarred = true;
    }

    // Fetch updated star count
    const { data: updatedCollection } = await client
      .from("collections")
      .select("star_count")
      .eq("id", collectionId)
      .single();

    const starCount = (updatedCollection as { star_count: number | null } | null)?.star_count || 0;

    return NextResponse.json({
      isStarred,
      starCount,
    } as StarResponse);
  } catch (error) {
    console.error("Error toggling star:", error);
    return NextResponse.json(
      {
        isStarred: false,
        starCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      } as StarResponse,
      { status: 500 }
    );
  }
}
