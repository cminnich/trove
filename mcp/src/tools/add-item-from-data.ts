import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getUserId } from "../supabase.js";
import type { Database } from "../../../types/database.js";

type Item = Database["public"]["Tables"]["items"]["Row"];
type ItemInsert = Database["public"]["Tables"]["items"]["Insert"];
type CollectionItemInsert = Database["public"]["Tables"]["collection_items"]["Insert"];

export function registerAddItemFromData(server: McpServer) {
  server.tool(
    "add_item_from_data",
    "Add an item from structured data (no URL extraction needed). Use this for manually identified products, Gmail receipt imports, or post-photo-identification adds.",
    {
      title: z.string().describe("Product name/title"),
      brand: z.string().optional().describe("Brand or manufacturer"),
      price: z.number().optional().describe("Price as a number"),
      currency: z.string().optional().describe("Currency code (USD, EUR, etc.)"),
      category: z.string().optional().describe("Product category"),
      item_type: z.string().optional().describe("Item type (product, wine, watch, book, etc.)"),
      image_url: z.string().url().optional().describe("Product image URL"),
      source_url: z.string().url().optional().describe("Product page URL if known"),
      retailer: z.string().optional().describe("Retailer or store name"),
      tags: z.array(z.string()).optional().describe("Tags or keywords"),
      collection_id: z.string().uuid().optional().describe("Collection to add item to"),
      notes: z.string().optional().describe("Personal notes"),
    },
    async ({ title, brand, price, currency, category, item_type, image_url, source_url, retailer, tags, collection_id, notes }) => {
      const client = getClient();

      const insertData: ItemInsert = {
        title,
        brand: brand || null,
        price: price || null,
        currency: currency || null,
        category: category || null,
        item_type: item_type || "product",
        image_url: image_url || null,
        source_url: source_url || null,
        retailer: retailer || null,
        tags: tags || null,
        extraction_status: "complete",
        confidence_score: 1.0,
        attributes: {},
      };

      const { data, error } = await client
        .from("items")
        .insert(insertData as any)
        .select()
        .single();

      if (error || !data) {
        return { content: [{ type: "text" as const, text: `Error: ${error?.message || "Unknown"}` }], isError: true };
      }

      const item = data as Item;

      // Add to collection if specified
      if (collection_id) {
        const ciData: CollectionItemInsert = {
          item_id: item.id,
          collection_id,
          notes: notes || null,
        };
        const { error: ciError } = await client.from("collection_items").insert(ciData as any);
        if (ciError) {
          console.error("Failed to add to collection:", ciError.message);
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "complete",
            item: {
              id: item.id,
              title: item.title,
              brand: item.brand,
              price: item.price,
              currency: item.currency,
              category: item.category,
              image_url: item.image_url,
              source_url: item.source_url,
            },
            collection_id: collection_id || null,
          }, null, 2),
        }],
      };
    }
  );
}
