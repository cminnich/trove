import { NextRequest, NextResponse } from "next/server";
import { extractApiKeyFromHeader, authenticateApiKey } from "@/lib/api-auth";
import { getServiceRoleClient } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

interface V1Context {
  userId: string;
  supabase: SupabaseClient<Database>;
}

/**
 * Columns exposed for items in the public v1 API. Deliberately excludes
 * internal fields (raw_markdown, extraction internals, owner_id) that are not
 * part of the documented Item schema.
 */
export const V1_ITEM_COLUMNS =
  "id, source_url, title, item_type, brand, price, currency, retailer, image_url, category, tags, attributes, extraction_status, confidence_score, created_at, updated_at";

/**
 * Authenticate a v1 API request and return a service-role client + userId.
 * Returns a NextResponse error if auth fails, or the context on success.
 */
export async function authenticateV1Request(
  req: NextRequest
): Promise<V1Context | NextResponse> {
  const apiKey = extractApiKeyFromHeader(
    req.headers.get("authorization")
  );

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header. Use: Bearer trove_sk_..." },
      { status: 401 }
    );
  }

  const auth = await authenticateApiKey(apiKey);

  if (!auth.success || !auth.userId) {
    return NextResponse.json(
      { error: auth.error || "Authentication failed" },
      { status: 401 }
    );
  }

  return {
    userId: auth.userId,
    supabase: getServiceRoleClient(),
  };
}

/** Type guard: is the result an error response? */
export function isErrorResponse(
  result: V1Context | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
