import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type CollectionAssignment = {
  id: string;
  position?: number;
  notes?: string;
};

interface CreateItemRequest {
  url: string;
  collections?: CollectionAssignment[];
}

interface CreateItemResponse {
  success: boolean;
  status?: 'pending' | 'processing' | 'complete' | 'failed';
  data?: {
    item: Database["public"]["Tables"]["items"]["Row"];
    collections: string[]; // collection IDs the item was added to
  };
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CreateItemRequest;

    if (!body.url) {
      return NextResponse.json(
        { success: false, error: "URL is required" } as CreateItemResponse,
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" } as CreateItemResponse,
        { status: 400 }
      );
    }

    // Authenticate user - only authenticated users can create items
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - please sign in to add items" } as CreateItemResponse,
        { status: 401 }
      );
    }

    // Step 1: Check if this URL has been extracted before (items are public, can use service client for read)
    const supabase = getServiceRoleClient();

    const { data: existingItems }: {
      data: Database["public"]["Tables"]["items"]["Row"][] | null;
    } = await supabase
      .from('items')
      .select('*')
      .eq('source_url', body.url)
      .order('created_at', { ascending: false })
      .limit(1);

    const existingItem: Database["public"]["Tables"]["items"]["Row"] | null =
      existingItems && existingItems.length > 0 ? existingItems[0] : null;

    // If item exists and extraction is complete, return it immediately
    if (existingItem && existingItem.extraction_status === 'complete') {
      // If collections provided, assign to them
      const addedCollections: string[] = [];
      if (body.collections && body.collections.length > 0) {
        const collectionItems: Database["public"]["Tables"]["collection_items"]["Insert"][] =
          body.collections.map((col) => ({
            item_id: existingItem.id,
            collection_id: col.id,
            position: col.position,
            notes: col.notes,
          }));

        const { error: junctionError } = await client
          .from("collection_items")
          .insert(collectionItems as any);

        if (!junctionError) {
          addedCollections.push(...body.collections.map((c) => c.id));
        }
      }

      return NextResponse.json({
        success: true,
        status: 'complete',
        data: {
          item: existingItem,
          collections: addedCollections,
        },
      } as CreateItemResponse);
    }

    // If item exists but is still pending/processing, return it
    if (existingItem && (existingItem.extraction_status === 'pending' || existingItem.extraction_status === 'processing')) {
      return NextResponse.json({
        success: true,
        status: existingItem.extraction_status,
        data: {
          item: existingItem,
          collections: [],
        },
      } as CreateItemResponse, { status: 202 });
    }

    // Step 2: Create pending item immediately (Safety Layer)
    const pendingItemData: Database["public"]["Tables"]["items"]["Insert"] = {
      source_url: body.url,
      title: 'Extracting...',
      item_type: 'article',
      extraction_status: 'pending',
      attributes: {},
    };

    const { data: pendingItem, error: pendingItemError }: {
      data: Database["public"]["Tables"]["items"]["Row"] | null;
      error: any;
    } = await client
      .from("items")
      .insert(pendingItemData as any)
      .select()
      .single();

    if (pendingItemError || !pendingItem) {
      console.error("Failed to create pending item:", pendingItemError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to create item: ${pendingItemError?.message || "Unknown error"}`
        } as CreateItemResponse,
        { status: 500 }
      );
    }

    // Step 3: Assign to collections immediately if provided
    const addedCollections: string[] = [];
    if (body.collections && body.collections.length > 0) {
      const collectionItems: Database["public"]["Tables"]["collection_items"]["Insert"][] =
        body.collections.map((col) => ({
          item_id: pendingItem.id,
          collection_id: col.id,
          position: col.position,
          notes: col.notes,
        }));

      const { error: junctionError } = await client
        .from("collection_items")
        .insert(collectionItems as any);

      if (!junctionError) {
        addedCollections.push(...body.collections.map((c) => c.id));
      } else {
        console.error("Failed to add item to collections:", junctionError);
        // Continue anyway - item was created, collection assignment is secondary
      }
    }

    // Step 4: Return 202 Accepted immediately
    // Database trigger will automatically invoke Edge Function for extraction
    return NextResponse.json({
      success: true,
      status: 'pending',
      data: {
        item: pendingItem,
        collections: addedCollections,
      },
    } as CreateItemResponse, { status: 202 });

  } catch (error) {
    console.error("Error creating item:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      } as CreateItemResponse,
      { status: 500 }
    );
  }
}
