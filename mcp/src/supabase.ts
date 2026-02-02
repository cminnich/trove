import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TROVE_USER_ID } from "./config.js";

let client: SupabaseClient<Database> | null = null;

export function getClient(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return client;
}

export function getUserId(): string {
  return TROVE_USER_ID;
}
