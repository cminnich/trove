import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getUserId } from "../supabase.js";
import type { Database } from "../../../types/database.js";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

export function registerListCollections(server: McpServer) {
  server.tool(
    "list_collections",
    "List all of the user's collections with item counts",
    {},
    async () => {
      const client = getClient();
      const userId = getUserId();

      const { data: collections, error } = await client
        .from("collections")
        .select("*")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });

      if (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      }

      const cols = (collections || []) as Collection[];

      // Get item counts for each collection
      const results = await Promise.all(
        cols.map(async (col) => {
          const { count } = await client
            .from("collection_items")
            .select("*", { count: "exact", head: true })
            .eq("collection_id", col.id);

          return {
            id: col.id,
            name: col.name,
            description: col.description,
            visibility: col.visibility,
            item_count: count || 0,
            updated_at: col.updated_at,
          };
        })
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    }
  );
}
