import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";
import { sendEmail } from "@/lib/email";
import { collaborationInviteEmail, joinInviteEmail } from "@/lib/email-templates";

type CollectionAccess = Database["public"]["Tables"]["collection_access"]["Row"];
type CollectionAccessInsert = Database["public"]["Tables"]["collection_access"]["Insert"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Extended type for collaborator with profile info
interface Collaborator {
  id: string;
  invited_identity: string;
  access_level: "viewer" | "editor";
  granted_at: string;
  claimed_at: string | null;
  user_id: string | null;
  // Profile info (null if pending/unclaimed)
  profile: {
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface ListAccessResponse {
  success: boolean;
  data?: {
    collaborators: Collaborator[];
    owner: {
      id: string;
      email: string | null;
      avatar_url: string | null;
    } | null;
  };
  error?: string;
}

interface CreateAccessResponse {
  success: boolean;
  data?: CollectionAccess;
  error?: string;
}

interface DeleteAccessResponse {
  success: boolean;
  error?: string;
}

// GET /api/collections/[id]/access - List all collaborators
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;

    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ListAccessResponse,
        { status: 401 }
      );
    }

    // Verify user has access to this collection (RLS will enforce read access)
    const { data: collection, error: collectionError } = await client
      .from("collections")
      .select("id, owner_id")
      .eq("id", collectionId)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { success: false, error: "Collection not found" } as ListAccessResponse,
        { status: 404 }
      );
    }

    // Get owner profile
    const serviceClient = getServiceRoleClient();
    const { data: ownerProfile } = await serviceClient
      .from("profiles")
      .select("id, email, avatar_url")
      .eq("id", (collection as { id: string; owner_id: string }).owner_id)
      .single();

    // Get all access grants for this collection (RLS policy allows viewing if you're owner or have access)
    const { data: accessGrants, error: accessError } = await client
      .from("collection_access")
      .select("*")
      .eq("collection_id", collectionId)
      .order("granted_at", { ascending: false });

    if (accessError) {
      console.error("Failed to fetch access grants:", accessError);
      return NextResponse.json(
        { success: false, error: accessError.message } as ListAccessResponse,
        { status: 500 }
      );
    }

    // Build collaborator list with profile info
    const collaborators: Collaborator[] = [];

    for (const grant of (accessGrants || []) as CollectionAccess[]) {
      let profile: Collaborator["profile"] = null;

      if (grant.user_id) {
        // User has claimed access - fetch their profile
        const { data: userProfile } = await serviceClient
          .from("profiles")
          .select("email, avatar_url")
          .eq("id", grant.user_id)
          .single();

        if (userProfile) {
          profile = {
            email: (userProfile as Pick<Profile, "email" | "avatar_url">).email,
            avatar_url: (userProfile as Pick<Profile, "email" | "avatar_url">).avatar_url,
          };
        }
      }

      collaborators.push({
        id: grant.id,
        invited_identity: grant.invited_identity,
        access_level: grant.access_level,
        granted_at: grant.granted_at,
        claimed_at: grant.claimed_at,
        user_id: grant.user_id,
        profile,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        collaborators,
        owner: ownerProfile
          ? {
              id: (ownerProfile as Pick<Profile, "id" | "email" | "avatar_url">).id,
              email: (ownerProfile as Pick<Profile, "id" | "email" | "avatar_url">).email,
              avatar_url: (ownerProfile as Pick<Profile, "id" | "email" | "avatar_url">).avatar_url,
            }
          : null,
      },
    } as ListAccessResponse);
  } catch (error) {
    console.error("Error fetching collection access:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ListAccessResponse,
      { status: 500 }
    );
  }
}

// POST /api/collections/[id]/access - Invite a collaborator
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const body = await req.json();

    const { email, access_level = "viewer" } = body as {
      email?: string;
      access_level?: "viewer" | "editor";
    };

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Email is required" } as CreateAccessResponse,
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" } as CreateAccessResponse,
        { status: 400 }
      );
    }

    // Validate access level
    if (access_level !== "viewer" && access_level !== "editor") {
      return NextResponse.json(
        { success: false, error: "Access level must be 'viewer' or 'editor'" } as CreateAccessResponse,
        { status: 400 }
      );
    }

    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as CreateAccessResponse,
        { status: 401 }
      );
    }

    // Verify user owns this collection
    const { data: collection, error: collectionError } = await client
      .from("collections")
      .select("id, owner_id")
      .eq("id", collectionId)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { success: false, error: "Collection not found" } as CreateAccessResponse,
        { status: 404 }
      );
    }

    const typedCollection = collection as { id: string; owner_id: string };

    if (typedCollection.owner_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Only the collection owner can invite collaborators" } as CreateAccessResponse,
        { status: 403 }
      );
    }

    // Check if user is trying to invite themselves
    const serviceClient = getServiceRoleClient();
    const { data: ownerProfile } = await serviceClient
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    const inviterEmail = (ownerProfile as Pick<Profile, "email"> | null)?.email || "";
    const inviterName = inviterEmail.split("@")[0] || "A Trove user";

    if (ownerProfile && (ownerProfile as Pick<Profile, "email">).email?.toLowerCase() === normalizedEmail) {
      return NextResponse.json(
        { success: false, error: "You cannot invite yourself" } as CreateAccessResponse,
        { status: 400 }
      );
    }

    // Check if this email already has access
    const { data: existingAccess } = await client
      .from("collection_access")
      .select("id")
      .eq("collection_id", collectionId)
      .eq("invited_identity", normalizedEmail)
      .maybeSingle();

    if (existingAccess) {
      return NextResponse.json(
        { success: false, error: "This email already has access to this collection" } as CreateAccessResponse,
        { status: 400 }
      );
    }

    // Check if a user with this email already exists
    const { data: existingUser } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    // Fetch collection name for the email
    const { data: collectionData } = await client
      .from("collections")
      .select("name")
      .eq("id", collectionId)
      .single();
    const collectionName = (collectionData as { name: string } | null)?.name || "a collection";

    // Prepare the insert data
    const insertData: CollectionAccessInsert = {
      collection_id: collectionId,
      invited_identity: normalizedEmail,
      access_level,
      granted_by: user.id,
      // If user exists, link them immediately
      user_id: existingUser ? (existingUser as Pick<Profile, "id">).id : null,
      claimed_at: existingUser ? new Date().toISOString() : null,
    };

    // Insert the access grant (RLS policy allows owner to insert)
    const { data: accessGrant, error: insertError } = await (client as any)
      .from("collection_access")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create access grant:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message } as CreateAccessResponse,
        { status: 500 }
      );
    }

    // Fire-and-forget email (non-blocking)
    sendEmail({
      to: normalizedEmail,
      subject: existingUser
        ? `${inviterName} invited you to edit "${collectionName}" on Trove`
        : `${inviterName} invited you to join Trove`,
      html: existingUser
        ? collaborationInviteEmail({ inviterName, collectionName, collectionId, accessLevel: access_level })
        : joinInviteEmail({ inviterName, inviterEmail }),
    }).then(result => {
      if (!result.success) {
        console.error(`Failed to send invitation email to ${normalizedEmail}:`, result.error);
      }
    });

    return NextResponse.json({
      success: true,
      data: accessGrant as CollectionAccess,
    } as CreateAccessResponse);
  } catch (error) {
    console.error("Error creating collection access:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as CreateAccessResponse,
      { status: 500 }
    );
  }
}

// DELETE /api/collections/[id]/access - Revoke access
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const { searchParams } = new URL(req.url);
    const accessId = searchParams.get("access_id");

    if (!accessId) {
      return NextResponse.json(
        { success: false, error: "access_id query parameter is required" } as DeleteAccessResponse,
        { status: 400 }
      );
    }

    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as DeleteAccessResponse,
        { status: 401 }
      );
    }

    // Verify user owns this collection
    const { data: collection, error: collectionError } = await client
      .from("collections")
      .select("id, owner_id")
      .eq("id", collectionId)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { success: false, error: "Collection not found" } as DeleteAccessResponse,
        { status: 404 }
      );
    }

    const typedCollection = collection as { id: string; owner_id: string };

    if (typedCollection.owner_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Only the collection owner can revoke access" } as DeleteAccessResponse,
        { status: 403 }
      );
    }

    // Delete the access grant (RLS policy allows owner to delete)
    const { error: deleteError } = await client
      .from("collection_access")
      .delete()
      .eq("id", accessId)
      .eq("collection_id", collectionId);

    if (deleteError) {
      console.error("Failed to delete access grant:", deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message } as DeleteAccessResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    } as DeleteAccessResponse);
  } catch (error) {
    console.error("Error deleting collection access:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as DeleteAccessResponse,
      { status: 500 }
    );
  }
}
