import { NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";

/** GET /api/chats — List the user's assistant chat threads (newest first). */
export async function GET() {
  const { client, user, error: authError } = await getAuthenticatedServerClient();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await client
    .from("assistant_chats")
    .select("id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chats: data ?? [] });
}
