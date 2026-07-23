import { NextRequest, NextResponse } from "next/server";
import { authenticateV1Request, isErrorResponse } from "@/lib/v1-handler";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

/** GET /api/v1/collections/:id — Get a collection with item count */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await authenticateV1Request(req);
    if (isErrorResponse(ctx)) return ctx;

    const { data: collectionData, error } = await ctx.supabase
      .from("collections")
      .select("id, name, description, type, visibility, created_at, updated_at")
      .eq("id", id)
      .eq("owner_id", ctx.userId)
      .single();

    if (error || !collectionData) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const collection = collectionData as Pick<Collection, "id" | "name" | "description" | "type" | "visibility" | "created_at" | "updated_at">;

    // Get item count
    const { count } = await ctx.supabase
      .from("collection_items")
      .select("*", { count: "exact", head: true })
      .eq("collection_id", id);

    return NextResponse.json({
      collection: { ...collection, item_count: count || 0 },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
