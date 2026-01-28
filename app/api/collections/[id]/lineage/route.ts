import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface LineageResponse {
  success: boolean;
  data?: {
    forked_from: {
      owner_username: string | null;
      collection_name: string | null;
      collection_id: string | null;
      still_exists: boolean;
    } | null;
    fork_count: number;
  };
  error?: string;
}

// GET /api/collections/[id]/lineage - Get fork lineage for a collection
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;

    const serviceClient = getServiceRoleClient();

    // Get collection fork count
    const { data: collection, error: collectionError } = await serviceClient
      .from("collections")
      .select("fork_count")
      .eq("id", collectionId)
      .single();

    if (collectionError) {
      return NextResponse.json(
        { success: false, error: "Collection not found" } as LineageResponse,
        { status: 404 }
      );
    }

    // Check if this collection is a fork
    const { data: forkRecord, error: forkError } = await serviceClient
      .from("collection_forks")
      .select("source_collection_id, source_owner_username, source_collection_name")
      .eq("forked_collection_id", collectionId)
      .maybeSingle();

    let forkedFrom = null;

    if (!forkError && forkRecord) {
      const typedFork = forkRecord as {
        source_collection_id: string | null;
        source_owner_username: string | null;
        source_collection_name: string | null;
      };

      // Check if source still exists
      let stillExists = false;
      if (typedFork.source_collection_id) {
        const { data: sourceExists } = await serviceClient
          .from("collections")
          .select("id")
          .eq("id", typedFork.source_collection_id)
          .eq("visibility", "public")
          .maybeSingle();
        stillExists = !!sourceExists;
      }

      forkedFrom = {
        owner_username: typedFork.source_owner_username,
        collection_name: typedFork.source_collection_name,
        collection_id: typedFork.source_collection_id,
        still_exists: stillExists,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        forked_from: forkedFrom,
        fork_count: (collection as Pick<Collection, "fork_count">).fork_count || 0,
      },
    } as LineageResponse);
  } catch (error) {
    console.error("Error fetching lineage:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as LineageResponse,
      { status: 500 }
    );
  }
}
