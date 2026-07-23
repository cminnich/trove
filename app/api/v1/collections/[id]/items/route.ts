import { NextRequest, NextResponse } from "next/server";
import {
  authenticateV1Request,
  isErrorResponse,
  parsePagination,
  V1_ITEM_COLUMNS,
} from "@/lib/v1-handler";
import type { Database } from "@/types/database";

type Item = Database["public"]["Tables"]["items"]["Row"];

type CollectionItemWithItem = {
  added_at: string;
  position: number | null;
  notes: string | null;
  items: Item;
};

/**
 * Link an item to a collection idempotently. collection_items has a composite
 * PK (collection_id, item_id), so a duplicate link raises 23505 — treat that as
 * "already linked" rather than a 500.
 */
async function linkItemToCollection(
  supabase: { from: (t: string) => any },
  collectionId: string,
  itemId: string,
  notes: string | null,
  position: number | null
): Promise<{ alreadyLinked: boolean; error: string | null }> {
  const { error } = await supabase
    .from("collection_items")
    .insert({ collection_id: collectionId, item_id: itemId, notes, position });

  if (error) {
    if (error.code === "23505") return { alreadyLinked: true, error: null };
    return { alreadyLinked: false, error: error.message };
  }
  return { alreadyLinked: false, error: null };
}

/** GET /api/v1/collections/:id/items — List items in a collection */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await authenticateV1Request(req);
    if (isErrorResponse(ctx)) return ctx;

    // Verify ownership
    const { data: collection } = await ctx.supabase
      .from("collections")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ctx.userId)
      .single();

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const { limit, offset } = parsePagination(req.url);

    const { data, error } = await ctx.supabase
      .from("collection_items")
      .select(`
        added_at,
        position,
        notes,
        items (${V1_ITEM_COLUMNS})
      `)
      .eq("collection_id", id)
      .order("position", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = (data as unknown as CollectionItemWithItem[]).map((ci) => ({
      ...ci.items,
      added_at: ci.added_at,
      position: ci.position,
      notes: ci.notes,
    }));

    return NextResponse.json({ items, limit, offset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** POST /api/v1/collections/:id/items — Add item to collection (by URL or item_id) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await authenticateV1Request(req);
    if (isErrorResponse(ctx)) return ctx;

    // Verify ownership
    const { data: collection } = await ctx.supabase
      .from("collections")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ctx.userId)
      .single();

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const body = await req.json();

    // Option A: Add by existing item_id
    if (body.item_id) {
      // Validate the item exists so a bad id returns 404, not an FK 500
      const { data: itemExists } = await ctx.supabase
        .from("items")
        .select("id")
        .eq("id", body.item_id)
        .single();

      if (!itemExists) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      const { alreadyLinked, error } = await linkItemToCollection(
        ctx.supabase,
        id,
        body.item_id,
        body.notes || null,
        body.position ?? null
      );

      if (error) {
        return NextResponse.json({ error }, { status: 500 });
      }

      return NextResponse.json(
        { success: true, item_id: body.item_id, already_linked: alreadyLinked },
        { status: alreadyLinked ? 200 : 201 }
      );
    }

    // Option B: Add by URL — create item (triggers extraction), then link
    if (body.url) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(body.url);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }

      // Check if URL already extracted
      const { data: existingItems } = await ctx.supabase
        .from("items")
        .select("*")
        .eq("source_url", body.url)
        .order("created_at", { ascending: false })
        .limit(1);

      type ItemRow = Database["public"]["Tables"]["items"]["Row"];
      const existing: ItemRow | null =
        existingItems && (existingItems as ItemRow[]).length > 0
          ? (existingItems as ItemRow[])[0]
          : null;

      if (existing && existing.extraction_status === "complete") {
        // Link existing item to collection (idempotent)
        const { alreadyLinked, error: linkError } = await linkItemToCollection(
          ctx.supabase,
          id,
          existing.id,
          body.notes || null,
          body.position ?? null
        );

        if (linkError) {
          return NextResponse.json({ error: linkError }, { status: 500 });
        }

        return NextResponse.json({
          item: existing,
          status: "complete",
          is_existing: true,
          already_linked: alreadyLinked,
        });
      }

      // Create new pending item (owner_id set so the creator can access it;
      // extraction is triggered by the on_item_insert DB trigger).
      const { data: newItem, error: insertError } = await (ctx.supabase as any)
        .from("items")
        .insert({
          owner_id: ctx.userId,
          source_url: body.url,
          title: "Extracting...",
          item_type: "article",
          extraction_status: "pending",
          attributes: {},
        })
        .select()
        .single();

      if (insertError || !newItem) {
        return NextResponse.json(
          { error: "Failed to create item" },
          { status: 500 }
        );
      }

      // Link the newly created item to the collection
      const { error: linkError } = await linkItemToCollection(
        ctx.supabase,
        id,
        (newItem as ItemRow).id,
        body.notes || null,
        body.position ?? null
      );

      if (linkError) {
        return NextResponse.json({ error: linkError }, { status: 500 });
      }

      return NextResponse.json(
        { item: newItem, status: "pending", is_existing: false },
        { status: 202 }
      );
    }

    return NextResponse.json(
      { error: "Either url or item_id is required" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/v1/collections/:id/items/:itemId — Remove item from collection */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await authenticateV1Request(req);
    if (isErrorResponse(ctx)) return ctx;

    // Get item_id from query params since this route doesn't have [itemId] segment
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("item_id");

    if (!itemId) {
      return NextResponse.json(
        { error: "item_id query parameter is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: collection } = await ctx.supabase
      .from("collections")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ctx.userId)
      .single();

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const { error } = await ctx.supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", id)
      .eq("item_id", itemId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
