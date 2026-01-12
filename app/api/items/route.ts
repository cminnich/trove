import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import { getServerClient } from "@/lib/supabase";
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
    const supabase = getServerClient();

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
    const response = NextResponse.json({
      success: true,
      status: 'pending',
      data: {
        item: pendingItem,
        collections: addedCollections,
      },
    } as CreateItemResponse, { status: 202 });

    // Step 5: Trigger background extraction (Phase 1 - still in API route)
    // In Phase 2, this will be handled by database trigger + Edge Function
    performBackgroundExtraction(pendingItem.id, body.url, req.nextUrl.origin).catch(error => {
      console.error("Background extraction failed:", error);
    });

    return response;

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

/**
 * Background extraction function (Phase 1 implementation)
 *
 * In Phase 2, this logic will move to Supabase Edge Function
 * and be triggered automatically via database trigger.
 */
async function performBackgroundExtraction(itemId: string, url: string, origin: string) {
  try {
    // Get service client for updating item
    const supabase = getServerClient();

    // Update status to 'processing'
    const processingUpdate: Database["public"]["Tables"]["items"]["Update"] = {
      extraction_status: 'processing',
      extraction_started_at: new Date().toISOString(),
    };
    await supabase
      .from('items')
      // @ts-expect-error - New columns added in migration 008, types will sync after migration runs
      .update(processingUpdate)
      .eq('id', itemId);

    // Call extraction API
    const extractResponse = await fetch(`${origin}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!extractResponse.ok) {
      const errorData = await extractResponse.json();
      // Update item with failed status
      const failedUpdate: Database["public"]["Tables"]["items"]["Update"] = {
        extraction_status: 'failed',
        extraction_error: errorData.error || 'Extraction failed',
        extraction_completed_at: new Date().toISOString(),
      };
      await supabase
        .from('items')
        // @ts-expect-error - New columns added in migration 008, types will sync after migration runs
        .update(failedUpdate)
        .eq('id', itemId);
      return;
    }

    const extractionResult = await extractResponse.json();

    if (!extractionResult.success || !extractionResult.data) {
      const noDataUpdate: Database["public"]["Tables"]["items"]["Update"] = {
        extraction_status: 'failed',
        extraction_error: 'Extraction did not return valid data',
        extraction_completed_at: new Date().toISOString(),
      };
      await supabase
        .from('items')
        // @ts-expect-error - New columns added in migration 008, types will sync after migration runs
        .update(noDataUpdate)
        .eq('id', itemId);
      return;
    }

    const extracted = extractionResult.data;

    // Update item with extracted data
    const updateData: Database["public"]["Tables"]["items"]["Update"] = {
      raw_markdown: extracted.raw_markdown,
      title: extracted.title,
      brand: extracted.brand,
      price: extracted.price,
      currency: extracted.currency,
      retailer: extracted.retailer,
      image_url: extracted.image_url,
      category: extracted.category,
      tags: extracted.tags,
      item_type: extracted.item_type || "article",
      attributes: extracted.attributes || {},
      confidence_score: extracted.confidence_score,
      extraction_model: extracted.extraction_model,
      extraction_status: 'complete',
      extraction_completed_at: new Date().toISOString(),
      last_extracted_at: new Date().toISOString(),
    };

    const { data: updatedItemRaw, error: updateError } = await supabase
      .from('items')
      // @ts-expect-error - New columns added in migration 008, types will sync after migration runs
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    const updatedItem = updatedItemRaw as Database["public"]["Tables"]["items"]["Row"] | null;

    if (updateError) {
      console.error("Failed to update item with extraction results:", updateError);
      const saveFailedUpdate: Database["public"]["Tables"]["items"]["Update"] = {
        extraction_status: 'failed',
        extraction_error: `Failed to save extraction results: ${updateError.message}`,
        extraction_completed_at: new Date().toISOString(),
      };
      await supabase
        .from('items')
        // @ts-expect-error - New columns added in migration 008, types will sync after migration runs
        .update(saveFailedUpdate)
        .eq('id', itemId);
      return;
    }

    // Create snapshot for the extracted data
    if (updatedItem) {
      const snapshotData: Database["public"]["Tables"]["item_snapshots"]["Insert"] = {
        item_id: updatedItem.id,
        price: extracted.price,
        currency: extracted.currency,
        image_url: extracted.image_url,
        raw_markdown: extracted.raw_markdown,
        captured_at: new Date().toISOString(),
      };

      const { data: snapshot } = await supabase
        .from("item_snapshots")
        .insert(snapshotData as any)
        .select()
        .single();

      // Update item with snapshot reference
      if (snapshot) {
        const snapshotUpdate: Database["public"]["Tables"]["items"]["Update"] = {
          current_snapshot_id: (snapshot as Database["public"]["Tables"]["item_snapshots"]["Row"]).id
        };
        await supabase
          .from("items")
          // @ts-expect-error - Snapshot reference update
          .update(snapshotUpdate)
          .eq("id", itemId);
      }
    }

    console.log(`✓ Background extraction completed for item ${itemId}`);
  } catch (error) {
    console.error(`Background extraction failed for item ${itemId}:`, error);

    // Try to mark as failed
    try {
      const supabase = getServerClient();
      const catchFailedUpdate: Database["public"]["Tables"]["items"]["Update"] = {
        extraction_status: 'failed',
        extraction_error: error instanceof Error ? error.message : 'Unknown error',
        extraction_completed_at: new Date().toISOString(),
      };
      await supabase
        .from('items')
        // @ts-expect-error - New columns added in migration 008, types will sync after migration runs
        .update(catchFailedUpdate)
        .eq('id', itemId);
    } catch (updateError) {
      console.error(`Failed to update item status to failed:`, updateError);
    }
  }
}
