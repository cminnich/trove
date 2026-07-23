import { NextRequest, NextResponse } from "next/server";
import { authenticateV1Request, isErrorResponse } from "@/lib/v1-handler";
import type { Database } from "@/types/database";

type CollectionInsert = Database["public"]["Tables"]["collections"]["Insert"];

/** GET /api/v1/collections — List user's collections */
export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticateV1Request(req);
    if (isErrorResponse(ctx)) return ctx;

    const { data, error } = await ctx.supabase
      .from("collections")
      .select("id, name, description, type, visibility, created_at, updated_at")
      .eq("owner_id", ctx.userId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ collections: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** POST /api/v1/collections — Create a new collection */
export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticateV1Request(req);
    if (isErrorResponse(ctx)) return ctx;

    const body = await req.json();
    const name = (body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const insertData: CollectionInsert = {
      owner_id: ctx.userId,
      name,
      description: body.description || null,
      visibility: body.visibility === "private" ? "private" : "public",
    };

    const { data, error } = await (ctx.supabase as any)
      .from("collections")
      .insert(insertData)
      .select("id, name, description, type, visibility, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ collection: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
