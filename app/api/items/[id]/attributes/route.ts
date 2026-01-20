import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type ItemAttribute = Database["public"]["Tables"]["item_attributes"]["Row"];
type AttributeSchema = Database["public"]["Tables"]["attribute_schemas"]["Row"];

interface AttributeWithSchema extends ItemAttribute {
  schema: AttributeSchema;
}

interface AttributeWithCount {
  attribute: AttributeWithSchema;
  related_count: number; // How many other items share this attribute value
}

interface ItemAttributesResponse {
  success: boolean;
  data?: AttributeWithCount[];
  total_collection_items?: number;
  error?: string;
}

// GET /api/items/[id]/attributes - Get item attributes with related counts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
    const { searchParams } = new URL(req.url);
    const collectionId = searchParams.get("collection_id");

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ItemAttributesResponse,
        { status: 401 }
      );
    }

    const supabase = getServiceRoleClient();

    // Fetch item attributes with schema info
    const { data: attributesData, error: attrsError } = await supabase
      .from("item_attributes")
      .select(`
        *,
        schema:attribute_schemas (*)
      `)
      .eq("item_id", itemId)
      .order("schema_id");

    if (attrsError) {
      console.error("Failed to fetch item attributes:", attrsError);
      return NextResponse.json(
        { success: false, error: attrsError.message } as ItemAttributesResponse,
        { status: 500 }
      );
    }

    // Cast to proper type
    const attributes = attributesData as unknown as AttributeWithSchema[] | null;

    if (!attributes || attributes.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      } as ItemAttributesResponse);
    }

    // Get counts of related items for each attribute
    const groupKeys = attributes.map((a) => a.group_key);

    // Count all items with each attribute (including current item)
    const { data: relatedAttrsData, error: countError } = await supabase
      .from("item_attributes")
      .select("group_key, item_id")
      .in("group_key", groupKeys);

    if (countError) {
      console.error("Failed to fetch related counts:", countError);
      // Continue without counts rather than failing
    }

    // Cast to proper type
    type RelatedAttr = { group_key: string; item_id: string };
    const relatedAttrs = relatedAttrsData as RelatedAttr[] | null;

    // Build count map
    const countMap = new Map<string, Set<string>>();
    if (relatedAttrs) {
      for (const attr of relatedAttrs) {
        if (!countMap.has(attr.group_key)) {
          countMap.set(attr.group_key, new Set());
        }
        countMap.get(attr.group_key)!.add(attr.item_id);
      }
    }

    // If collection_id provided, filter to only items in that collection
    let collectionItemIds: Set<string> | null = null;
    let totalCollectionItems = 0;
    if (collectionId) {
      const { data: collectionItemsData } = await supabase
        .from("collection_items")
        .select("item_id")
        .eq("collection_id", collectionId);

      type CollectionItemSelection = { item_id: string };
      const collectionItems = collectionItemsData as CollectionItemSelection[] | null;
      if (collectionItems) {
        collectionItemIds = new Set(collectionItems.map((ci) => ci.item_id));
        totalCollectionItems = collectionItems.length;
      }
    }

    // Build response with counts
    const result: AttributeWithCount[] = attributes.map((attr) => {
      let relatedItemIds = countMap.get(attr.group_key) || new Set<string>();

      // Filter to collection if specified
      if (collectionItemIds) {
        relatedItemIds = new Set(
          Array.from(relatedItemIds).filter((id) => collectionItemIds!.has(id))
        );
      }

      return {
        attribute: attr as unknown as AttributeWithSchema,
        related_count: relatedItemIds.size,
      };
    });

    // Sort by display order from schema
    result.sort((a, b) => {
      const orderA = a.attribute.schema?.display_order ?? 999;
      const orderB = b.attribute.schema?.display_order ?? 999;
      return orderA - orderB;
    });

    return NextResponse.json({
      success: true,
      data: result,
      total_collection_items: totalCollectionItems > 0 ? totalCollectionItems : undefined,
    } as ItemAttributesResponse);
  } catch (error) {
    console.error("Error fetching item attributes:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ItemAttributesResponse,
      { status: 500 }
    );
  }
}
