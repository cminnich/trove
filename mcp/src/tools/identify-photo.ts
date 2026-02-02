import { z } from "zod";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ANTHROPIC_API_KEY, JINA_API_KEY } from "../config.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

// Inlined from types/extraction.ts to avoid CJS/ESM boundary issues
const PhotoIdentificationItemSchema = z.object({
  title: z.string().describe("Best guess at product name including brand"),
  brand: z.string().nullable().describe("Brand or manufacturer if identifiable"),
  item_type: z.string().default("product").describe("Entity type (watch, wine, book, sneaker, etc.)"),
  category: z.string().nullable().describe("Product category"),
  search_query: z.string().describe("Precise search query to find this exact product online"),
  confidence_score: z.number().min(0).max(1).describe("Confidence in identification (0-1)"),
  distinguishing_features: z.string().describe("Key visual features for matching against search results"),
});

type PhotoIdentificationItem = z.infer<typeof PhotoIdentificationItemSchema>;

const PhotoIdentificationSchema = z.object({
  items: z.array(PhotoIdentificationItemSchema),
  item_count: z.number(),
  scene_description: z.string().describe("Brief description of what the photo shows"),
});

interface ProductSearchResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
}

async function searchProductUrl(query: string): Promise<ProductSearchResult[]> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (JINA_API_KEY) {
    headers["Authorization"] = `Bearer ${JINA_API_KEY}`;
  }

  try {
    const response = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, { headers });
    if (!response.ok) {
      console.error("Jina Search failed:", response.status, response.statusText);
      return [];
    }
    const json = await response.json();
    const results: any[] = json.data || [];
    return results
      .filter((r: any) => r.url && r.title)
      .slice(0, 5)
      .map((r: any) => {
        let domain = "";
        try { domain = new URL(r.url).hostname.replace("www.", ""); } catch {}
        return { url: r.url, title: r.title, snippet: r.description || r.content || "", domain };
      });
  } catch (err) {
    console.error("Jina Search error:", err);
    return [];
  }
}

function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split(".").pop();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return mimeMap[ext || ""] || "image/jpeg";
}

export function registerIdentifyPhoto(server: McpServer) {
  server.tool(
    "identify_photo",
    "Identify products in a photo using Claude Vision, then search for product URLs. Returns identified items with candidate purchase URLs. Does NOT auto-create items - chain with add_item or add_item_from_data.",
    {
      image_path: z.string().describe("Absolute path to the image file on disk"),
    },
    async ({ image_path }) => {
      if (!ANTHROPIC_API_KEY) {
        return { content: [{ type: "text" as const, text: "Error: ANTHROPIC_API_KEY is required for photo identification" }], isError: true };
      }

      // Read and encode image
      let imageBase64: string;
      let mimeType: string;
      try {
        const imageBuffer = readFileSync(image_path);
        imageBase64 = imageBuffer.toString("base64");
        mimeType = getMimeType(image_path);
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error reading image: ${err instanceof Error ? err.message : "Unknown"}` }], isError: true };
      }

      // Load prompt
      const promptPath = resolve(__dirname, "../../../prompts/photo_identification.txt");
      let prompt: string;
      try {
        prompt = readFileSync(promptPath, "utf-8");
      } catch {
        // Inline fallback prompt
        prompt = "Identify the product(s) visible in this photo. For each item, provide: title (brand + model), search query, distinguishing features, and confidence score (0-1).";
      }

      // Call Claude Vision via Anthropic SDK
      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

      try {
        const response = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 2048,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
              },
              {
                type: "text",
                text: prompt + "\n\nRespond with valid JSON matching this schema: { items: [{ title, brand, item_type, category, search_query, confidence_score, distinguishing_features }], item_count: number, scene_description: string }",
              },
            ],
          }],
        });

        // Parse response
        const textBlock = response.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          return { content: [{ type: "text" as const, text: "Error: No text response from Claude Vision" }], isError: true };
        }

        let jsonText = textBlock.text.trim();
        // Strip markdown code blocks if present
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        let identification;
        try {
          identification = PhotoIdentificationSchema.parse(JSON.parse(jsonText));
        } catch (parseErr) {
          console.error("Failed to parse identification:", parseErr);
          return { content: [{ type: "text" as const, text: `Error parsing Claude response: ${jsonText.substring(0, 500)}` }], isError: true };
        }

        if (!identification.items || identification.items.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                items: [],
                scene_description: identification.scene_description,
                message: "No identifiable products found in the photo.",
              }, null, 2),
            }],
          };
        }

        // Search for product URLs for each identified item
        const items = await Promise.all(
          identification.items.map(async (item: PhotoIdentificationItem) => {
            const candidates = await searchProductUrl(item.search_query);
            return { identification: item, candidates };
          })
        );

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              items,
              scene_description: identification.scene_description,
              message: `Identified ${items.length} item(s). Use add_item (with a candidate URL) or add_item_from_data (with the identification details) to add them to Trove.`,
            }, null, 2),
          }],
        };
      } catch (err) {
        console.error("Claude Vision error:", err);
        return { content: [{ type: "text" as const, text: `Error from Claude Vision: ${err instanceof Error ? err.message : "Unknown"}` }], isError: true };
      }
    }
  );
}
