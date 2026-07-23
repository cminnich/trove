import { NextRequest, NextResponse } from "next/server";
import {
  authenticateV1Request,
  isErrorResponse,
  V1_ITEM_COLUMNS,
} from "@/lib/v1-handler";

/** GET /api/v1/items/:id — Get item details (owner or via a collection you can access) */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await authenticateV1Request(req);
    if (isErrorResponse(ctx)) return ctx;

    const { data, error } = await ctx.supabase
      .from("items")
      .select(`${V1_ITEM_COLUMNS}, owner_id`)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Authorize: the caller must own the item, or be able to reach it through a
    // collection they own / were granted access to. 404 (not 403) so we don't
    // reveal the existence of items the caller can't see.
    const row = data as Record<string, unknown> & { owner_id: string | null };
    if (row.owner_id !== ctx.userId) {
      const { data: canAccess } = await (ctx.supabase as any).rpc(
        "user_can_access_item",
        { p_item_id: id, p_user_id: ctx.userId }
      );
      if (!canAccess) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
    }

    const { owner_id: _ownerId, ...item } = row;
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
