import { getServiceRoleClient } from "@/lib/supabase-server";
import { hashApiKey, validateApiKeyFormat } from "@/lib/api-key-utils";
import type { Database } from "@/types/database";

type ApiKey = Database["public"]["Tables"]["api_keys"]["Row"];

interface AuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/** Extract a Bearer API key from the Authorization header */
export function extractApiKeyFromHeader(
  authHeader: string | null
): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(trove_sk_.+)$/);
  return match ? match[1] : null;
}

/**
 * Authenticate a request using an API key.
 * Validates format, looks up hash, checks active + not expired.
 * Updates last_used_at asynchronously.
 */
export async function authenticateApiKey(
  apiKey: string
): Promise<AuthResult> {
  if (!validateApiKeyFormat(apiKey)) {
    return { success: false, error: "Invalid API key format" };
  }

  const hash = hashApiKey(apiKey);
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", hash)
    .single();

  if (error || !data) {
    return { success: false, error: "Invalid API key" };
  }

  const key = data as ApiKey;

  if (!key.is_active) {
    return { success: false, error: "API key has been revoked" };
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { success: false, error: "API key has expired" };
  }

  // Fire-and-forget: update last_used_at
  (supabase as any)
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .then(() => {});

  return { success: true, userId: key.user_id };
}
