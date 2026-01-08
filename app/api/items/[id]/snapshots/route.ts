import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Snapshot = Database["public"]["Tables"]["item_snapshots"]["Row"];

interface GetSnapshotsResponse {
  success: boolean;
  data?: Snapshot[];
  error?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Item ID is required" } as GetSnapshotsResponse,
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    // Fetch all snapshots for this item, ordered by capture time (newest first)
    const { data: snapshots, error: snapshotsError } = await supabase
      .from("item_snapshots")
      .select("*")
      .eq("item_id", id)
      .order("captured_at", { ascending: false });

    if (snapshotsError) {
      console.error("Failed to fetch snapshots:", snapshotsError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch snapshots: ${snapshotsError.message}`,
        } as GetSnapshotsResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: snapshots || [],
    } as GetSnapshotsResponse);

  } catch (error) {
    console.error("Error fetching snapshots:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      } as GetSnapshotsResponse,
      { status: 500 }
    );
  }
}
