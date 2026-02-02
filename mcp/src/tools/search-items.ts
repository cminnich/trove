import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getUserId } from "../supabase.js";
import type { Database } from "../../../types/database.js";

type Item = Database["public"]["Tables"]["items"]["Row"];

export function registerSearchItems(server: McpServer) {
  server.tool(
    "search_items",
    "Search across the user's items by title, brand, category, or tags",
    {
      query: z.string().describe("Search text"),
      collection_id: z.string().uuid().optional().describe("Optionally scope search to a specific collection"),
    },
    async ({ query, collection_id }) => {
      const client = getClient();
      const userId = getUserId();

      // Get user's collection IDs to scope items
      let scopeCollectionIds: string[];

      if (collection_id) {
        // Verify collection belongs to user
        const { data: col } = await client
          .from("collections")
          .select("id")
          .eq("id", collection_id)
          .eq("owner_id", userId)
          .single();

        if (!col) {
          return { content: [{ type: "text" as const, text: "Error: Collection not found or not owned by you" }], isError: true };
        }
        scopeCollectionIds = [collection_id];
      } else {
        // Get all user's collections
        const { data: userCols } = await client
          .from("collections")
          .select("id")
          .eq("owner_id", userId);

        scopeCollectionIds = ((userCols || []) as { id: string }[]).map((c) => c.id);
      }

      if (scopeCollectionIds.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ items: [], total: 0 }, null, 2) }] };
      }

      // Get item IDs from user's collections
      const { data: ciData } = await client
        .from("collection_items")
        .select("item_id")
        .in("collection_id", scopeCollectionIds);

      const itemIds = [...new Set(((ciData || []) as { item_id: string }[]).map((ci) => ci.item_id))];

      if (itemIds.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ items: [], total: 0 }, null, 2) }] };
      }

      // Fetch items and filter by search query
      const { data: items, error } = await client
        .from("items")
        .select("*")
        .in("id", itemIds);

      if (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      }

      const allItems = (items || []) as Item[];
      const lowerQuery = query.toLowerCase();

      const matched = allItems.filter((item) => {
        const fields = [
          item.title,
          item.brand,
          item.category,
          item.retailer,
          ...(item.tags || []),
        ].filter(Boolean).map((f) => (f as string).toLowerCase());

        return fields.some((f) => f.includes(lowerQuery));
      });

      const results = matched.map((item) => ({
        id: item.id,
        title: item.title,
        brand: item.brand,
        price: item.price,
        currency: item.currency,
        category: item.category,
        image_url: item.image_url,
        source_url: item.source_url,
      }));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ items: results, total: results.length, query }, null, 2),
        }],
      };
    }
  );
}
