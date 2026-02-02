import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getUserId } from "../supabase.js";
import type { Database } from "../../../types/database.js";

type CollectionInsert = Database["public"]["Tables"]["collections"]["Insert"];
type Collection = Database["public"]["Tables"]["collections"]["Row"];

export function registerCreateCollection(server: McpServer) {
  server.tool(
    "create_collection",
    "Create a new collection",
    {
      name: z.string().describe("Collection name"),
      description: z.string().optional().describe("Collection description"),
      visibility: z.enum(["public", "private"]).optional().describe("Collection visibility (default: public)"),
    },
    async ({ name, description, visibility }) => {
      const client = getClient();
      const userId = getUserId();

      const insertData: CollectionInsert = {
        name,
        owner_id: userId,
        description: description || null,
        visibility: visibility || "public",
      };

      const { data, error } = await client
        .from("collections")
        .insert(insertData as any)
        .select()
        .single();

      if (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      }

      const collection = data as Collection;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: collection.id,
            name: collection.name,
            description: collection.description,
            visibility: collection.visibility,
            created_at: collection.created_at,
          }, null, 2),
        }],
      };
    }
  );
}
