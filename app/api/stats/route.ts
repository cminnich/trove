import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase-server";

interface StatsResponse {
  success: boolean;
  data?: {
    total_public_collections: number;
    total_forks: number;
  };
  error?: string;
}

// GET /api/stats - Get platform-wide statistics for homepage
export async function GET() {
  try {
    const serviceClient = getServiceRoleClient();

    // Count public collections
    const { count: publicCollectionsCount, error: collectionsError } = await serviceClient
      .from("collections")
      .select("*", { count: "exact", head: true })
      .eq("visibility", "public");

    if (collectionsError) {
      console.error("Failed to count public collections:", collectionsError);
    }

    // Count total forks
    const { count: forksCount, error: forksError } = await serviceClient
      .from("collection_forks")
      .select("*", { count: "exact", head: true });

    if (forksError) {
      console.error("Failed to count forks:", forksError);
    }

    return NextResponse.json({
      success: true,
      data: {
        total_public_collections: publicCollectionsCount || 0,
        total_forks: forksCount || 0,
      },
    } as StatsResponse);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as StatsResponse,
      { status: 500 }
    );
  }
}
