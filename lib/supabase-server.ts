import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Server-only Supabase utilities
 *
 * This file contains server-only functions that use Next.js server APIs
 * like cookies(). Do NOT import this file in client components.
 *
 * For client components, use lib/supabase.ts instead.
 */

/**
 * Service role client for privileged server-side operations.
 * Bypasses RLS - use with caution.
 * Uses createClient directly (not createServerClient) to ensure proper service role behavior.
 */
export function getServiceRoleClient(): SupabaseClient<Database> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }
  // Support both env var names for backwards compatibility
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Authenticated server client for API routes that respects RLS
// Returns both the client and the authenticated user
export async function getAuthenticatedServerClient(): Promise<{
  client: SupabaseClient<Database>;
  user: User | null;
  error: any;
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const cookieStore = await cookies();

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // Ignore errors from read-only cookie store in some contexts
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            // Ignore errors from read-only cookie store in some contexts
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return { client, user: null, error: authError };
  }

  return { client, user, error: null };
}
