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
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: existingItems }: {
      data: Database["public"]["Tables"]["items"]["Row"][] | null;
    } = await supabase
      .from('items')
      .select('*')
      .eq('source_url', body.url)
      .order('last_extracted_at', { ascending: false, nullsFirst: false })
      .limit(1);

    const existingItem: Database["public"]["Tables"]["items"]["Row"] | null =
      existingItems && existingItems.length > 0 ? existingItems[0] : null;

    // If item exists and was extracted recently (within 24 hours), return it without re-extracting
    if (existingItem && existingItem.last_extracted_at) {
      const lastExtractedAt = new Date(existingItem.last_extracted_at);
      if (lastExtractedAt > new Date(oneDayAgo)) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          data: existingItem,
          message: 'Item extracted recently (within 24 hours)'
        });
      }
    }

    // Step 2: Extract product data from URL
    const extractResponse = await fetch(`${req.nextUrl.origin}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: body.url }),
    });

    if (!extractResponse.ok) {
      const errorData = await extractResponse.json();
      return NextResponse.json(
        {
          success: false,
          error: `Extraction failed: ${errorData.error || extractResponse.statusText}`
        } as CreateItemResponse,
        { status: extractResponse.status }
      );
    }

    const extractionResult = await extractResponse.json();

    if (!extractionResult.success || !extractionResult.data) {
      return NextResponse.json(
        { success: false, error: "Extraction did not return valid data" } as CreateItemResponse,
        { status: 500 }
      );
    }

    const extracted = extractionResult.data;

    // Step 3: Save or update item and create snapshot
    let item: Database["public"]["Tables"]["items"]["Row"];

    if (existingItem) {
      // Item exists - create a new snapshot and update the item
      const snapshotData: Database["public"]["Tables"]["item_snapshots"]["Insert"] = {
        item_id: existingItem.id,
        price: extracted.price,
        currency: extracted.currency,
        image_url: extracted.image_url,
        raw_markdown: extracted.raw_markdown,
        captured_at: new Date().toISOString(),
      };

      const { data: snapshot, error: snapshotError }: {
        data: Database["public"]["Tables"]["item_snapshots"]["Row"] | null;
        error: any;
      } = await client
        .from("item_snapshots")
        .insert(snapshotData as any)
        .select()
        .single();

      if (snapshotError || !snapshot) {
        console.error("Failed to create snapshot:", snapshotError);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to create snapshot: ${snapshotError?.message || "Unknown error"}`
          } as CreateItemResponse,
          { status: 500 }
        );
      }

      // Update the item with latest data and snapshot reference
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
        item_type: extracted.item_type || "product",
        attributes: extracted.attributes || {},
        confidence_score: extracted.confidence_score,
        extraction_model: extracted.extraction_model,
        last_extracted_at: new Date().toISOString(),
        current_snapshot_id: snapshot.id,
      };

      const { data: updatedItem, error: updateError }: {
        data: Database["public"]["Tables"]["items"]["Row"] | null;
        error: any;
      } = await ((client as any)
        .from("items")
        .update(updateData)
        .eq("id", existingItem.id)
        .select()
        .single());

      if (updateError || !updatedItem) {
        console.error("Failed to update item:", updateError);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to update item: ${updateError?.message || "Unknown error"}`
          } as CreateItemResponse,
          { status: 500 }
        );
      }

      item = updatedItem;
    } else {
      // New item - create both item and first snapshot
      const insertData: Database["public"]["Tables"]["items"]["Insert"] = {
        source_url: extracted.source_url,
        raw_markdown: extracted.raw_markdown,
        title: extracted.title,
        brand: extracted.brand,
        price: extracted.price,
        currency: extracted.currency,
        retailer: extracted.retailer,
        image_url: extracted.image_url,
        category: extracted.category,
        tags: extracted.tags,
        item_type: extracted.item_type || "product",
        attributes: extracted.attributes || {},
        confidence_score: extracted.confidence_score,
        extraction_model: extracted.extraction_model,
        last_extracted_at: new Date().toISOString(),
      };

      const { data: newItem, error: itemError }: {
        data: Database["public"]["Tables"]["items"]["Row"] | null;
        error: any;
      } = await client
        .from("items")
        .insert(insertData as any)
        .select()
        .single();

      if (itemError || !newItem) {
        console.error("Failed to save item:", itemError);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to save item: ${itemError?.message || "Unknown error"}`
          } as CreateItemResponse,
          { status: 500 }
        );
      }

      // Create the first snapshot
      const snapshotData: Database["public"]["Tables"]["item_snapshots"]["Insert"] = {
        item_id: newItem.id,
        price: extracted.price,
        currency: extracted.currency,
        image_url: extracted.image_url,
        raw_markdown: extracted.raw_markdown,
        captured_at: new Date().toISOString(),
      };

      const { data: snapshot, error: snapshotError }: {
        data: Database["public"]["Tables"]["item_snapshots"]["Row"] | null;
        error: any;
      } = await client
        .from("item_snapshots")
        .insert(snapshotData as any)
        .select()
        .single();

      if (snapshotError || !snapshot) {
        console.error("Failed to create snapshot:", snapshotError);
        // Item was created but snapshot failed - continue anyway
      } else {
        // Update item with current_snapshot_id
        await ((client as any)
          .from("items")
          .update({ current_snapshot_id: snapshot.id })
          .eq("id", newItem.id));
      }

      item = newItem;
    }

    // Step 4: Add item to collections if specified
    const addedCollections: string[] = [];
    const savedItem = item as Database["public"]["Tables"]["items"]["Row"];

    if (body.collections && body.collections.length > 0) {
      const collectionItems: Database["public"]["Tables"]["collection_items"]["Insert"][] =
        body.collections.map((col) => ({
          item_id: savedItem.id,
          collection_id: col.id,
          position: col.position,
          notes: col.notes,
        }));

      const { error: junctionError } = await client
        .from("collection_items")
        .insert(collectionItems as any);

      if (junctionError) {
        // Item was saved but collection assignment failed
        console.error("Failed to add item to collections:", junctionError);
        return NextResponse.json(
          {
            success: false,
            error: `Item saved but failed to add to collections: ${junctionError.message}`,
          } as CreateItemResponse,
          { status: 500 }
        );
      }

      addedCollections.push(...body.collections.map((c) => c.id));
    }

    // Step 5: Return success response
    return NextResponse.json({
      success: true,
      data: {
        item,
        collections: addedCollections,
      },
    } as CreateItemResponse);

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
