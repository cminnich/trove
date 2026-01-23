import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type ItemAttribute = Database["public"]["Tables"]["item_attributes"]["Row"];
type AttributeSchema = Database["public"]["Tables"]["attribute_schemas"]["Row"];
type CollectionAttributeSchema = Database["public"]["Tables"]["collection_attribute_schemas"]["Row"];

// Unified schema interface that works for both global and collection schemas
interface UnifiedSchema {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  display_order: number;
  is_collection_schema: boolean;
  is_visible?: boolean; // Only for collection schemas
}

interface AttributeWithSchema extends ItemAttribute {
  schema: UnifiedSchema;
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

    // Fetch global item attributes with schema info
    const { data: globalAttrsData, error: globalError } = await supabase
      .from("item_attributes")
      .select(`
        *,
        schema:attribute_schemas (*)
      `)
      .eq("item_id", itemId)
      .not("schema_id", "is", null);

    if (globalError) {
      console.error("Failed to fetch global item attributes:", globalError);
      return NextResponse.json(
        { success: false, error: globalError.message } as ItemAttributesResponse,
        { status: 500 }
      );
    }

    // Convert global attributes to unified format
    type GlobalAttrRow = ItemAttribute & { schema: AttributeSchema | null };
    const globalAttrs = (globalAttrsData as GlobalAttrRow[] | null) || [];

    const unifiedGlobalAttrs: AttributeWithSchema[] = globalAttrs
      .filter((a) => a.schema !== null)
      .map((a) => ({
        ...a,
        schema: {
          id: a.schema!.id,
          name: a.schema!.name,
          display_name: a.schema!.display_name,
          description: a.schema!.description,
          display_order: a.schema!.display_order,
          is_collection_schema: false,
        },
      }));

    // Fetch collection-level attributes if collection_id provided
    let unifiedCollectionAttrs: AttributeWithSchema[] = [];

    if (collectionId) {
      // Get all collection schemas (both visible and hidden for settings panel)
      const { data: collectionSchemasData } = await supabase
        .from("collection_attribute_schemas")
        .select("*")
        .eq("collection_id", collectionId);

      const collectionSchemas = (collectionSchemasData as CollectionAttributeSchema[] | null) || [];
      const schemaIds = collectionSchemas.map((s) => s.id);

      if (schemaIds.length > 0) {
        // Fetch item attributes that use these collection schemas
        const { data: collectionAttrsData, error: collectionError } = await supabase
          .from("item_attributes")
          .select("*")
          .eq("item_id", itemId)
          .in("collection_schema_id", schemaIds);

        if (collectionError) {
          console.error("Failed to fetch collection item attributes:", collectionError);
        } else {
          const collectionAttrs = (collectionAttrsData as ItemAttribute[] | null) || [];

          // Map to unified format
          const schemaMap = new Map(collectionSchemas.map((s) => [s.id, s]));

          unifiedCollectionAttrs = collectionAttrs
            .filter((a) => a.collection_schema_id && schemaMap.has(a.collection_schema_id))
            .map((a) => {
              const schema = schemaMap.get(a.collection_schema_id!)!;
              return {
                ...a,
                schema: {
                  id: schema.id,
                  name: schema.name,
                  display_name: schema.display_name,
                  description: schema.description,
                  display_order: schema.display_order,
                  is_collection_schema: true,
                  is_visible: schema.is_visible,
                },
              };
            });
        }
      }
    }

    // Merge all attributes
    const allAttributes = [...unifiedGlobalAttrs, ...unifiedCollectionAttrs];

    if (allAttributes.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      } as ItemAttributesResponse);
    }

    // Get counts of related items for each attribute
    const groupKeys = allAttributes.map((a) => a.group_key);

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
    const result: AttributeWithCount[] = allAttributes.map((attr) => {
      let relatedItemIds = countMap.get(attr.group_key) || new Set<string>();

      // Filter to collection if specified
      if (collectionItemIds) {
        relatedItemIds = new Set(
          Array.from(relatedItemIds).filter((id) => collectionItemIds!.has(id))
        );
      }

      return {
        attribute: attr,
        related_count: relatedItemIds.size,
      };
    });

    // Sort by display order from schema (collection schemas come after global with order 999+)
    result.sort((a, b) => {
      const isCollectionA = a.attribute.schema.is_collection_schema;
      const isCollectionB = b.attribute.schema.is_collection_schema;

      // Global schemas first, then collection schemas
      if (isCollectionA !== isCollectionB) {
        return isCollectionA ? 1 : -1;
      }

      const orderA = a.attribute.schema.display_order ?? 999;
      const orderB = b.attribute.schema.display_order ?? 999;
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
