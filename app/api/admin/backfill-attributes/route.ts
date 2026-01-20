import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import { generateItemAttributes } from "@/lib/attribute-normalizer";
import type { Database } from "@/types/database";

type Item = Database["public"]["Tables"]["items"]["Row"];
type AttributeSchema = Database["public"]["Tables"]["attribute_schemas"]["Row"];
type ItemAttributeInsert = Database["public"]["Tables"]["item_attributes"]["Insert"];

interface BackfillResponse {
  success: boolean;
  data?: {
    processed: number;
    created: number;
    skipped: number;
    errors: number;
  };
  error?: string;
}

// POST /api/admin/backfill-attributes - Backfill attributes for existing items
export async function POST(req: NextRequest) {
  try {
    // Authenticate user (admin only in production)
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as BackfillResponse,
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 50;
    const offset = body.offset || 0;

    const supabase = getServiceRoleClient();

    // Fetch active attribute schemas
    const { data: schemas, error: schemasError } = await supabase
      .from("attribute_schemas")
      .select("*")
      .eq("is_active", true);

    if (schemasError || !schemas) {
      console.error("Failed to fetch schemas:", schemasError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch attribute schemas" } as BackfillResponse,
        { status: 500 }
      );
    }

    // Define the item type we're selecting
    type ItemSelection = {
      id: string;
      brand: string | null;
      price: number | null;
      category: string | null;
      retailer: string | null;
      item_type: string;
      attributes: Record<string, unknown>;
    };

    // Fetch items that need processing
    // Items with extraction_status = 'complete' that have brand, category, or retailer set
    const { data: itemsData, error: itemsError } = await supabase
      .from("items")
      .select("id, brand, price, category, retailer, item_type, attributes")
      .eq("extraction_status", "complete")
      .range(offset, offset + batchSize - 1)
      .order("created_at", { ascending: false });

    if (itemsError) {
      console.error("Failed to fetch items:", itemsError);
      return NextResponse.json(
        { success: false, error: itemsError.message } as BackfillResponse,
        { status: 500 }
      );
    }

    const items = itemsData as ItemSelection[] | null;

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          processed: 0,
          created: 0,
          skipped: 0,
          errors: 0,
        },
      } as BackfillResponse);
    }

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Process each item
    for (const item of items) {
      try {
        // Check if item already has attributes
        const { data: existingAttrs } = await supabase
          .from("item_attributes")
          .select("id")
          .eq("item_id", item.id)
          .limit(1);

        if (existingAttrs && existingAttrs.length > 0) {
          skipped++;
          continue;
        }

        // Generate attributes from item data
        // For backfill, we only use direct and computed attributes (no semantic extraction)
        const itemData = {
          id: item.id,
          brand: item.brand,
          price: item.price,
          category: item.category,
          retailer: item.retailer,
          item_type: item.item_type,
        };

        // Parse semantic attributes from existing attributes field if present
        const legacyAttrs = item.attributes as Record<string, unknown> | null;
        let semanticAttrs = undefined;

        // Try to extract color/material from existing attributes
        if (legacyAttrs) {
          semanticAttrs = {
            color: typeof legacyAttrs.color === "string" ? legacyAttrs.color : undefined,
            material:
              typeof legacyAttrs.material === "string"
                ? legacyAttrs.material
                : typeof legacyAttrs.case_material === "string"
                  ? legacyAttrs.case_material
                  : undefined,
          };
        }

        const attributes = generateItemAttributes(itemData, schemas, semanticAttrs);

        if (attributes.length === 0) {
          skipped++;
          continue;
        }

        // Insert attributes
        const { error: insertError } = await (supabase as any)
          .from("item_attributes")
          .insert(attributes);

        if (insertError) {
          console.error(`Failed to insert attributes for item ${item.id}:`, insertError);
          errors++;
          continue;
        }

        created += attributes.length;
      } catch (err) {
        console.error(`Error processing item ${item.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: items.length,
        created,
        skipped,
        errors,
      },
    } as BackfillResponse);
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as BackfillResponse,
      { status: 500 }
    );
  }
}
