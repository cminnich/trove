import { NextRequest, NextResponse } from "next/server";
import { authenticateV1Request, isErrorResponse } from "@/lib/v1-handler";
import type { Database } from "@/types/database";

type ItemRow = Database["public"]["Tables"]["items"]["Row"];

/** POST /api/v1/items — Create item from URL (triggers async extraction) */
export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticateV1Request(req);
    if (isErrorResponse(ctx)) return ctx;

    const body = await req.json();

    if (!body.url) {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 }
      );
    }

    try {
      new URL(body.url);
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

    const existing: ItemRow | null =
      existingItems && (existingItems as ItemRow[]).length > 0
        ? (existingItems as ItemRow[])[0]
        : null;

    if (existing && existing.extraction_status === "complete") {
      return NextResponse.json({
        item: existing,
        status: "complete",
        is_existing: true,
      });
    }

    if (
      existing &&
      (existing.extraction_status === "pending" ||
        existing.extraction_status === "processing")
    ) {
      return NextResponse.json(
        { item: existing, status: existing.extraction_status, is_existing: true },
        { status: 202 }
      );
    }

    // Create new pending item. owner_id lets the creator poll it via
    // GET /api/v1/items/:id before it's added to any collection. Extraction is
    // kicked off automatically by the on_item_insert DB trigger.
    const { data: newItem, error } = await (ctx.supabase as any)
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

    if (error || !newItem) {
      return NextResponse.json(
        { error: "Failed to create item" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { item: newItem, status: "pending", is_existing: false },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
