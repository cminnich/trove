import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

interface ReExtractResponse {
  success: boolean;
  error?: string;
  message?: string;
}

// POST /api/items/[id]/re-extract - Re-trigger extraction for an item
// Uses trusted worker pattern: verify ownership with RLS first, then escalate to service role
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // STEP 1: Authenticate the User (Standard RLS Check)
    // We use the authenticated client first. If this user doesn't own the item,
    // RLS will prevent them from finding it or updating it.
    const { client: authenticatedClient, user } = await getAuthenticatedServerClient();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ReExtractResponse,
        { status: 401 }
      );
    }

    // STEP 2: Verify Ownership (The "Gatekeeper" Check)
    // We try to select the item with all fields needed for validation.
    // Thanks to RLS, if the user doesn't own it, this returns 0 rows or an error.
    const { data: item, error: rlsError } = await authenticatedClient
      .from("items")
      .select("id, extraction_status, extraction_started_at, source_url")
      .eq("id", id)
      .single<{
        id: string;
        extraction_status: 'pending' | 'processing' | 'complete' | 'failed';
        extraction_started_at: string | null;
        source_url: string | null;
      }>();

    if (rlsError || !item) {
      // This is the "Proper" security check. We don't bypass auth to check access.
      // We let the database reject the request if the user is malicious.
      return NextResponse.json(
        { success: false, error: "Item not found or access denied" } as ReExtractResponse,
        { status: 404 }
      );
    }

    // STEP 3: Validate Retry Conditions (Business Logic Check)
    // Allow re-extraction if:
    // - Status is 'failed'
    // - Status is 'processing' but started more than 60 seconds ago (stuck)
    const canRetry =
      item.extraction_status === "failed" ||
      (item.extraction_status === "processing" &&
        item.extraction_started_at &&
        new Date().getTime() - new Date(item.extraction_started_at).getTime() > 60000);

    if (!canRetry && item.extraction_status === "processing") {
      return NextResponse.json(
        {
          success: false,
          error: "Extraction is already in progress. Please wait.",
        } as ReExtractResponse,
        { status: 400 }
      );
    }

    // Verify item has a source URL
    if (!item.source_url) {
      return NextResponse.json(
        {
          success: false,
          error: "Item has no source URL to extract from",
        } as ReExtractResponse,
        { status: 400 }
      );
    }

    // STEP 4: Perform the Privileged Action (The "Trusted Worker")
    // Now that we PROVED the user owns the item, we can safely escalate privileges
    // to invoke the Edge Function using the Service Role JWT.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_JWT) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_JWT");
    }

    // Use the JWT specifically for the Edge Function invocation
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_JWT,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Update status immediately for UI feedback (Admin write)
    const updateData: Database["public"]["Tables"]["items"]["Update"] = {
      extraction_status: "processing",
      extraction_started_at: new Date().toISOString(),
      extraction_error: null,
    };
    // Type assertion needed for Supabase TypeScript compatibility
    const { error: updateError } = await (supabaseAdmin as any)
      .from("items")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update item status:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update item status",
        } as ReExtractResponse,
        { status: 500 }
      );
    }

    // Invoke the function (Admin invoke)
    const { data: functionData, error: invokeError } = await supabaseAdmin.functions.invoke(
      "extract-item",
      {
        body: { item_id: id },
      }
    );

    if (invokeError) {
      console.error("Failed to invoke extract-item function:", invokeError);

      // Revert status on failure
      const revertData: Database["public"]["Tables"]["items"]["Update"] = {
        extraction_status: "failed",
        extraction_error: `Failed to trigger extraction: ${invokeError.message}`,
        extraction_completed_at: new Date().toISOString(),
      };
      // Type assertion needed for Supabase TypeScript compatibility
      await (supabaseAdmin as any)
        .from("items")
        .update(revertData)
        .eq("id", id);

      return NextResponse.json(
        {
          success: false,
          error: `Failed to trigger extraction: ${invokeError.message}`,
        } as ReExtractResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Extraction triggered successfully",
    } as ReExtractResponse);
  } catch (error) {
    console.error("Error in re-extract endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      } as ReExtractResponse,
      { status: 500 }
    );
  }
}
