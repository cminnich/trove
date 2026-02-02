import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getUserId } from "../supabase.js";
import type { Database } from "../../../types/database.js";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

export function registerGetCollectionItems(server: McpServer) {
  server.tool(
    "get_collection_items",
    "List items in a specific collection with metadata",
    {
      collection_id: z.string().uuid().describe("Collection ID"),
      sort: z.enum(["recent", "position", "price_asc", "price_desc"]).optional().describe("Sort order (default: recent)"),
    },
    async ({ collection_id, sort }) => {
      const client = getClient();
      const userId = getUserId();

      // Verify collection belongs to user
      const { data: collection, error: colError } = await client
        .from("collections")
        .select("*")
        .eq("id", collection_id)
        .eq("owner_id", userId)
        .single();

      if (colError || !collection) {
        return { content: [{ type: "text" as const, text: "Error: Collection not found or not owned by you" }], isError: true };
      }

      const col = collection as Collection;

      // Fetch collection items with joined item data
      const { data: collectionItems, error: ciError } = await client
        .from("collection_items")
        .select("item_id, notes, position, added_at")
        .eq("collection_id", collection_id);

      if (ciError) {
        return { content: [{ type: "text" as const, text: `Error: ${ciError.message}` }], isError: true };
      }

      const ciRows = (collectionItems || []) as { item_id: string; notes: string | null; position: number | null; added_at: string }[];

      if (ciRows.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              collection: { id: col.id, name: col.name },
              items: [],
              total: 0,
            }, null, 2),
          }],
        };
      }

      // Fetch actual item data
      const itemIds = ciRows.map((ci) => ci.item_id);
      const { data: items, error: itemsError } = await client
        .from("items")
        .select("*")
        .in("id", itemIds);

      if (itemsError) {
        return { content: [{ type: "text" as const, text: `Error: ${itemsError.message}` }], isError: true };
      }

      type ItemRow = Database["public"]["Tables"]["items"]["Row"];
      const itemMap = new Map((items as ItemRow[] || []).map((item) => [item.id, item]));

      // Merge collection_items metadata with item data
      let merged = ciRows.map((ci) => {
        const item = itemMap.get(ci.item_id);
        return {
          item_id: ci.item_id,
          title: item?.title || null,
          brand: item?.brand || null,
          price: item?.price || null,
          currency: item?.currency || null,
          category: item?.category || null,
          image_url: item?.image_url || null,
          source_url: item?.source_url || null,
          extraction_status: item?.extraction_status || null,
          notes: ci.notes,
          position: ci.position,
          added_at: ci.added_at,
        };
      });

      // Sort
      const sortBy = sort || "recent";
      if (sortBy === "recent") {
        merged.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
      } else if (sortBy === "position") {
        merged.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
      } else if (sortBy === "price_asc") {
        merged.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      } else if (sortBy === "price_desc") {
        merged.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            collection: { id: col.id, name: col.name, description: col.description },
            items: merged,
            total: merged.length,
          }, null, 2),
        }],
      };
    }
  );
}
