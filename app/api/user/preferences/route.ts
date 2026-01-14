import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface PreferencesResponse {
  success: boolean;
  data?: {
    default_visibility: 'public' | 'private';
  };
  error?: string;
}

interface UpdatePreferencesRequest {
  default_visibility: 'public' | 'private';
}

// GET /api/user/preferences - Get user preferences
export async function GET() {
  try {
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as PreferencesResponse,
        { status: 401 }
      );
    }

    // Get user profile with preferences
    const { data: profile, error } = await client
      .from("profiles")
      .select("default_visibility")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Failed to fetch user preferences:", error);
      return NextResponse.json(
        { success: false, error: error.message } as PreferencesResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        default_visibility: profile?.default_visibility || 'public',
      },
    } as PreferencesResponse);
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as PreferencesResponse,
      { status: 500 }
    );
  }
}

// PATCH /api/user/preferences - Update user preferences
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as UpdatePreferencesRequest;

    if (!body.default_visibility || !['public', 'private'].includes(body.default_visibility)) {
      return NextResponse.json(
        { success: false, error: "Invalid default_visibility value. Must be 'public' or 'private'" } as PreferencesResponse,
        { status: 400 }
      );
    }

    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as PreferencesResponse,
        { status: 401 }
      );
    }

    // Check if profile exists
    const { data: existingProfile } = await client
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      // Create profile if it doesn't exist
      const { error: insertError } = await client
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email || null,
          default_visibility: body.default_visibility,
        });

      if (insertError) {
        console.error("Failed to create profile:", insertError);
        return NextResponse.json(
          { success: false, error: insertError.message } as PreferencesResponse,
          { status: 500 }
        );
      }
    } else {
      // Update existing profile
      const { error: updateError } = await client
        .from("profiles")
        .update({
          default_visibility: body.default_visibility,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Failed to update preferences:", updateError);
        return NextResponse.json(
          { success: false, error: updateError.message } as PreferencesResponse,
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        default_visibility: body.default_visibility,
      },
    } as PreferencesResponse);
  } catch (error) {
    console.error("Error updating preferences:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as PreferencesResponse,
      { status: 500 }
    );
  }
}
