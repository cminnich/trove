import { NextRequest, NextResponse } from "next/server";
import { authenticateV1Request, isErrorResponse } from "@/lib/v1-handler";
import type { Database } from "@/types/database";

type ItemRow = Database["public"]["Tables"]["items"]["Row"];

/** GET /api/v1/items/search?q=... — Search user's items (title, brand, category) */
export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticateV1Request(req);
    if (isErrorResponse(ctx)) return ctx;

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q) {
      return NextResponse.json(
        { error: "q query parameter is required" },
        { status: 400 }
      );
    }

    // Get all collection IDs owned by this user
    const { data: userCollections } = await ctx.supabase
      .from("collections")
      .select("id")
      .eq("owner_id", ctx.userId);

    if (!userCollections || userCollections.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const collectionIds = (userCollections as { id: string }[]).map((c) => c.id);

    // Get item IDs that belong to the user's collections
    const { data: collectionItems } = await ctx.supabase
      .from("collection_items")
      .select("item_id")
      .in("collection_id", collectionIds);

    if (!collectionItems || collectionItems.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const itemIds = [
      ...new Set((collectionItems as { item_id: string }[]).map((ci) => ci.item_id)),
    ];

    // Search within those items
    const pattern = `%${q}%`;
    const { data, error } = await ctx.supabase
      .from("items")
      .select("*")
      .in("id", itemIds)
      .or(`title.ilike.${pattern},brand.ilike.${pattern},category.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: (data || []) as ItemRow[] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
