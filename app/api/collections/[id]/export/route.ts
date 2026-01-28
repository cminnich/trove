import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface ExportItem {
  title: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  item_type: string;
  source_url: string | null;
  image_url: string | null;
  tags: string[] | null;
  attributes: Record<string, unknown>;
  notes: string | null;
  position: number | null;
}

// GET /api/collections/[id]/export - Export collection items
// Query params: format=json|csv
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    if (format !== "json" && format !== "csv") {
      return NextResponse.json(
        { success: false, error: "Invalid format. Use 'json' or 'csv'" },
        { status: 400 }
      );
    }

    // Try authenticated client first (for private collections user owns)
    const { client, user } = await getAuthenticatedServerClient();
    const serviceClient = getServiceRoleClient();

    // Get collection metadata
    const { data: collection, error: collectionError } = await serviceClient
      .from("collections")
      .select("id, name, visibility, owner_id")
      .eq("id", collectionId)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { success: false, error: "Collection not found" },
        { status: 404 }
      );
    }

    const typedCollection = collection as Pick<Collection, "id" | "name" | "visibility" | "owner_id">;

    // Check access: must be public OR owned by user
    const isOwner = user && typedCollection.owner_id === user.id;
    const isPublic = typedCollection.visibility === "public";

    if (!isPublic && !isOwner) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Fetch items with collection metadata
    const { data: collectionItems, error: itemsError } = await serviceClient
      .from("collection_items")
      .select(`
        position,
        notes,
        items (
          id,
          title,
          brand,
          price,
          currency,
          category,
          item_type,
          source_url,
          image_url,
          tags,
          attributes
        )
      `)
      .eq("collection_id", collectionId)
      .order("position", { ascending: true, nullsFirst: false });

    if (itemsError) {
      console.error("Failed to fetch items:", itemsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch items" },
        { status: 500 }
      );
    }

    // Transform data for export
    const exportItems: ExportItem[] = (collectionItems || []).map((ci) => {
      const typedCi = ci as {
        position: number | null;
        notes: string | null;
        items: Item | null;
      };
      const item = typedCi.items;
      return {
        title: item?.title || null,
        brand: item?.brand || null,
        price: item?.price || null,
        currency: item?.currency || null,
        category: item?.category || null,
        item_type: item?.item_type || "unknown",
        source_url: item?.source_url || null,
        image_url: item?.image_url || null,
        tags: item?.tags || null,
        attributes: item?.attributes || {},
        notes: typedCi.notes,
        position: typedCi.position,
      };
    });

    if (format === "json") {
      const exportData = {
        collection_name: typedCollection.name,
        exported_at: new Date().toISOString(),
        item_count: exportItems.length,
        items: exportItems,
      };

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${typedCollection.name.replace(/[^a-z0-9]/gi, "_")}_export.json"`,
        },
      });
    }

    // CSV format
    const csvHeaders = [
      "title",
      "brand",
      "price",
      "currency",
      "category",
      "item_type",
      "source_url",
      "image_url",
      "tags",
      "notes",
      "position",
    ];

    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      csvHeaders.join(","),
      ...exportItems.map((item) =>
        [
          escapeCSV(item.title),
          escapeCSV(item.brand),
          escapeCSV(item.price),
          escapeCSV(item.currency),
          escapeCSV(item.category),
          escapeCSV(item.item_type),
          escapeCSV(item.source_url),
          escapeCSV(item.image_url),
          escapeCSV(item.tags?.join("; ")),
          escapeCSV(item.notes),
          escapeCSV(item.position),
        ].join(",")
      ),
    ];

    return new NextResponse(csvRows.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${typedCollection.name.replace(/[^a-z0-9]/gi, "_")}_export.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
