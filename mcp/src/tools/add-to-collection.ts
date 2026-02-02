import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getUserId } from "../supabase.js";
import type { Database } from "../../../types/database.js";

type CollectionItemInsert = Database["public"]["Tables"]["collection_items"]["Insert"];

export function registerAddToCollection(server: McpServer) {
  server.tool(
    "add_to_collection",
    "Add an existing item to a collection (creates the association)",
    {
      item_id: z.string().uuid().describe("Item ID"),
      collection_id: z.string().uuid().describe("Collection ID"),
      notes: z.string().optional().describe("Personal notes about this item in this collection"),
    },
    async ({ item_id, collection_id, notes }) => {
      const client = getClient();
      const userId = getUserId();

      // Verify collection belongs to user
      const { data: col } = await client
        .from("collections")
        .select("id, name")
        .eq("id", collection_id)
        .eq("owner_id", userId)
        .single();

      if (!col) {
        return { content: [{ type: "text" as const, text: "Error: Collection not found or not owned by you" }], isError: true };
      }

      // Verify item exists
      const { data: item } = await client
        .from("items")
        .select("id, title")
        .eq("id", item_id)
        .single();

      if (!item) {
        return { content: [{ type: "text" as const, text: "Error: Item not found" }], isError: true };
      }

      // Upsert into collection_items
      const ciData: CollectionItemInsert = {
        item_id,
        collection_id,
        notes: notes || null,
      };

      const { error } = await client
        .from("collection_items")
        .upsert(ciData as any, { onConflict: "collection_id,item_id" });

      if (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      }

      const colData = col as { id: string; name: string };
      const itemData = item as { id: string; title: string | null };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            item_id,
            item_title: itemData.title,
            collection_id,
            collection_name: colData.name,
          }, null, 2),
        }],
      };
    }
  );
}
