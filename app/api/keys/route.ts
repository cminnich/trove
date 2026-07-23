import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import {
  generateApiKey,
  hashApiKey,
  getKeyPrefix,
} from "@/lib/api-key-utils";
import type { Database } from "@/types/database";

type ApiKeyInsert = Database["public"]["Tables"]["api_keys"]["Insert"];

/** POST /api/keys — Create a new API key (cookie auth). Returns full key once. */
export async function POST(req: NextRequest) {
  try {
    const { client, user, error: authError } =
      await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const name = (body.name || "").trim();

    if (!name || name.length > 100) {
      return NextResponse.json(
        { error: "Name is required (1-100 characters)" },
        { status: 400 }
      );
    }

    const plainKey = generateApiKey();
    const insertData: ApiKeyInsert = {
      user_id: user.id,
      name,
      key_prefix: getKeyPrefix(plainKey),
      key_hash: hashApiKey(plainKey),
    };

    const { data, error } = await (client as any)
      .from("api_keys")
      .insert(insertData)
      .select("id, name, key_prefix, created_at")
      .single();

    if (error) {
      console.error("Failed to create API key:", error);
      return NextResponse.json(
        { error: "Failed to create API key" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...data,
      key: plainKey, // shown once, never stored
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** GET /api/keys — List the user's API keys (cookie auth). Returns prefixes only. */
export async function GET() {
  try {
    const { client, user, error: authError } =
      await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data, error } = await client
      .from("api_keys")
      .select("id, name, key_prefix, is_active, last_used_at, created_at, expires_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to list API keys:", error);
      return NextResponse.json(
        { error: "Failed to list API keys" },
        { status: 500 }
      );
    }

    return NextResponse.json({ keys: data });
  } catch (error) {
    console.error("Error listing API keys:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
