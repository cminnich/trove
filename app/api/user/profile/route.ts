import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";
import { Filter } from "bad-words";

interface ProfileResponse {
  success: boolean;
  data?: {
    username: string;
  };
  error?: string;
}

interface UpdateProfileRequest {
  username: string;
}

// Word lists for username generation (matching migration)
const ADJECTIVES = [
  'Agile', 'Bold', 'Brave', 'Bright', 'Busy', 'Calm', 'Chill', 'Clever',
  'Cool', 'Crafty', 'Crisp', 'Curious', 'Daring', 'Deep', 'Eager', 'Epic',
  'Fair', 'Fast', 'Fine', 'Free', 'Fresh', 'Glad', 'Good', 'Grand', 'Green',
  'Happy', 'High', 'Jolly', 'Keen', 'Kind', 'Light', 'Loud', 'Lucky', 'Neat',
  'Nice', 'Noble', 'Odd', 'Pale', 'Proud', 'Pure', 'Quick', 'Rare', 'Real',
  'Rich', 'Safe', 'Sharp', 'Smart', 'Sure', 'Sweet', 'Swift', 'Tall', 'Tidy',
  'True', 'Vast', 'Warm', 'Wild', 'Wise', 'Zen', 'Zesty', 'Zippy'
];

const NOUNS = [
  'Badger', 'Bear', 'Beaver', 'Bird', 'Bison', 'Camel', 'Cat', 'Cobra',
  'Coder', 'Crane', 'Crow', 'Deer', 'Dingo', 'Dodo', 'Dog', 'Dolphin', 'Dove',
  'Duck', 'Eagle', 'Elk', 'Emu', 'Falcon', 'Ferret', 'Finch', 'Finder', 'Fish',
  'Fox', 'Frog', 'Gecko', 'Goat', 'Goose', 'Guide', 'Gull', 'Hare', 'Hawk',
  'Heron', 'Horse', 'Hunter', 'Keeper', 'Kiwi', 'Koala', 'Lark', 'Lemur',
  'Lion', 'Llama', 'Loon', 'Lynx', 'Magpie', 'Maker', 'Mole', 'Moose', 'Moth',
  'Mouse', 'Newt', 'Nomad', 'Otter', 'Owl', 'Panda', 'Pilot', 'Puma', 'Rabbit',
  'Racer', 'Ranger', 'Rat', 'Raven', 'Ray', 'Rider', 'Robin', 'Rogue', 'Scout',
  'Seal', 'Seeker', 'Shark', 'Sheep', 'Sloth', 'Snake', 'Snipe', 'Spider',
  'Squid', 'Stork', 'Swan', 'Swift', 'Tiger', 'Toad', 'Turtle', 'Walker',
  'Wasp', 'Whale', 'Wolf', 'Wren', 'Yak', 'Zebra'
];

async function generateUniqueUsername(client: any): Promise<string> {
  const maxAttempts = 100;

  for (let i = 0; i < maxAttempts; i++) {
    // Generate random username
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const number = Math.floor(Math.random() * 90) + 10; // 10-99
    const username = `${adjective}${noun}${number}`;

    // Check if it exists
    const { data: existingUser } = await client
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (!existingUser) {
      return username;
    }
  }

  throw new Error("Could not generate unique username after maximum attempts");
}

// GET /api/user/profile - Generate a new random username
export async function GET() {
  try {
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ProfileResponse,
        { status: 401 }
      );
    }

    const username = await generateUniqueUsername(client);

    return NextResponse.json({
      success: true,
      data: {
        username,
      },
    } as ProfileResponse);
  } catch (error) {
    console.error("Error generating username:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ProfileResponse,
      { status: 500 }
    );
  }
}

// PATCH /api/user/profile - Update user profile (username)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as UpdateProfileRequest;

    if (!body.username) {
      return NextResponse.json(
        { success: false, error: "Username is required" } as ProfileResponse,
        { status: 400 }
      );
    }

    const username = body.username.trim();

    // Sanity check: 3-20 characters, alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        {
          success: false,
          error: "Username must be 3-20 characters and contain only letters, numbers, and underscores"
        } as ProfileResponse,
        { status: 400 }
      );
    }

    // Profanity check
    const filter = new Filter();
    if (filter.isProfane(username)) {
      return NextResponse.json(
        { success: false, error: "Username contains inappropriate language" } as ProfileResponse,
        { status: 400 }
      );
    }

    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ProfileResponse,
        { status: 401 }
      );
    }

    // Uniqueness check (excluding current user)
    const { data: existingUser } = await client
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", user.id)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Username is already taken" } as ProfileResponse,
        { status: 409 }
      );
    }

    // Update profile
    type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
    const updateData: ProfileUpdate = {
      username: username,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await (client as any)
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update username:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message } as ProfileResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        username: username,
      },
    } as ProfileResponse);
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ProfileResponse,
      { status: 500 }
    );
  }
}
