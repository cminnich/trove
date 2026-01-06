import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface CreateCollectionRequest {
  name: string;
  description?: string;
  type?: string;
}

interface CollectionResponse {
  success: boolean;
  data?: Collection | Collection[];
  error?: string;
}

// GET /api/collections - List all collections
export async function GET() {
  try {
    const supabase = getServerClient();

    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch collections:", error);
      return NextResponse.json(
        { success: false, error: error.message } as CollectionResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    } as CollectionResponse);
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as CollectionResponse,
      { status: 500 }
    );
  }
}

// POST /api/collections - Create a new collection
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CreateCollectionRequest;

    if (!body.name || body.name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Collection name is required" } as CollectionResponse,
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    const { data, error } = await supabase
      .from("collections")
      .insert({
        name: body.name,
        description: body.description,
        type: body.type,
        user_id: null, // POC: no user auth yet
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create collection:", error);
      return NextResponse.json(
        { success: false, error: error.message } as CollectionResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    } as CollectionResponse);
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as CollectionResponse,
      { status: 500 }
    );
  }
}
