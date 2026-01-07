import { NextRequest, NextResponse } from "next/server";
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

    // Step 1: Check for duplicate URL (saves API costs)
    const supabase = getServerClient();
    const { data: existingItem } = await supabase
      .from('items')
      .select('id, title, created_at, image_url, price, currency, brand, item_type, confidence_score')
      .eq('source_url', body.url)
      .single();

    if (existingItem) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        data: existingItem
      });
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

    // Step 3: Save item to database

    const { data: item, error: itemError } = await supabase
      .from("items")
      .insert({
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
      })
      .select()
      .single();

    if (itemError || !item) {
      console.error("Failed to save item:", itemError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to save item: ${itemError?.message || "Unknown error"}`
        } as CreateItemResponse,
        { status: 500 }
      );
    }

    // Step 4: Add item to collections if specified
    const addedCollections: string[] = [];

    if (body.collections && body.collections.length > 0) {
      const collectionItems = body.collections.map((col) => ({
        item_id: item.id,
        collection_id: col.id,
        position: col.position,
        notes: col.notes,
      }));

      const { error: junctionError } = await supabase
        .from("collection_items")
        .insert(collectionItems);

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
