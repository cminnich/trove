import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getUserId } from "../supabase.js";
import type { Database } from "../../../types/database.js";

type Item = Database["public"]["Tables"]["items"]["Row"];
type ItemInsert = Database["public"]["Tables"]["items"]["Insert"];
type CollectionItemInsert = Database["public"]["Tables"]["collection_items"]["Insert"];

export function registerAddItem(server: McpServer) {
  server.tool(
    "add_item",
    "Add a product to Trove by URL. Triggers async extraction of product data. Returns immediately with pending status.",
    {
      url: z.string().url().describe("Product page URL"),
      collection_id: z.string().uuid().optional().describe("Collection to add item to"),
      notes: z.string().optional().describe("Personal notes about this item"),
    },
    async ({ url, collection_id, notes }) => {
      const client = getClient();
      const userId = getUserId();

      // Check for existing item by URL (dedup)
      const { data: existingItems } = await client
        .from("items")
        .select("*")
        .eq("source_url", url)
        .order("created_at", { ascending: false })
        .limit(1);

      const existingItem = (existingItems as Item[] | null)?.[0] || null;

      // If item exists and extraction is complete, return it
      if (existingItem && existingItem.extraction_status === "complete") {
        // Add to collection if specified
        if (collection_id) {
          const ciData: CollectionItemInsert = {
            item_id: existingItem.id,
            collection_id,
            notes: notes || null,
          };
          await client.from("collection_items").insert(ciData as any);
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "complete",
              is_existing: true,
              item: {
                id: existingItem.id,
                title: existingItem.title,
                brand: existingItem.brand,
                price: existingItem.price,
                currency: existingItem.currency,
                category: existingItem.category,
                image_url: existingItem.image_url,
                source_url: existingItem.source_url,
              },
              collection_id: collection_id || null,
            }, null, 2),
          }],
        };
      }

      // If item exists but still processing, return status
      if (existingItem && (existingItem.extraction_status === "pending" || existingItem.extraction_status === "processing")) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: existingItem.extraction_status,
              is_existing: true,
              item: { id: existingItem.id, title: existingItem.title, source_url: existingItem.source_url },
              message: "Item is still being extracted. Check back shortly.",
            }, null, 2),
          }],
        };
      }

      // Create new pending item
      const pendingData: ItemInsert = {
        source_url: url,
        title: "Extracting...",
        item_type: "article",
        extraction_status: "pending",
        attributes: {},
      };

      const { data: newItem, error } = await client
        .from("items")
        .insert(pendingData as any)
        .select()
        .single();

      if (error || !newItem) {
        return { content: [{ type: "text" as const, text: `Error creating item: ${error?.message || "Unknown"}` }], isError: true };
      }

      const item = newItem as Item;

      // Add to collection if specified
      if (collection_id) {
        const ciData: CollectionItemInsert = {
          item_id: item.id,
          collection_id,
          notes: notes || null,
        };
        await client.from("collection_items").insert(ciData as any);
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "pending",
            is_existing: false,
            item: { id: item.id, title: item.title, source_url: item.source_url },
            collection_id: collection_id || null,
            message: "Item created. Extraction will run in the background via database trigger.",
          }, null, 2),
        }],
      };
    }
  );
}
