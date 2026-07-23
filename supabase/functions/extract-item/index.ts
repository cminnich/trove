import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const JINA_READER_BASE = "https://r.jina.ai/";
const CLAUDE_MODEL = "claude-sonnet-5";
const EXTRACTION_TIMEOUT_MS = 90000; // 90 seconds

// Extraction prompt template (optimized for token efficiency)
const EXTRACTION_PROMPT = `Extract structured product data from webpage content.

**Entity Type**: Set item_type to lowercase singular noun (watch, wine, book, sneaker, camera). Default to "product" only if no better fit.

**Core Fields**: title (required), brand, price (number), currency, retailer, image_url, category, tags

**Attributes**: Extract technical specs into attributes object. Use snake_case keys with units (weight_kg, power_reserve_hours). Numbers not strings. Arrays for multi-value. Omit nulls.

Return valid JSON: {item_type, title, brand, price, currency, retailer, image_url, category, tags, attributes, confidence_score}. Be accurate.

Webpage content:

{{MARKDOWN_CONTENT}}`;

interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          id: string;
          source_url: string | null;
          extraction_status: 'pending' | 'processing' | 'complete' | 'failed';
          [key: string]: any;
        };
        Update: {
          extraction_status?: 'pending' | 'processing' | 'complete' | 'failed';
          extraction_error?: string | null;
          extraction_started_at?: string | null;
          extraction_completed_at?: string | null;
          raw_markdown?: string | null;
          title?: string | null;
          brand?: string | null;
          price?: number | null;
          currency?: string | null;
          retailer?: string | null;
          image_url?: string | null;
          category?: string | null;
          tags?: string[] | null;
          item_type?: string;
          attributes?: Record<string, unknown>;
          confidence_score?: number | null;
          extraction_model?: string;
          last_extracted_at?: string | null;
          [key: string]: any;
        };
      };
      item_snapshots: {
        Insert: {
          item_id: string;
          price?: number | null;
          currency?: string | null;
          image_url?: string | null;
          raw_markdown?: string | null;
          captured_at?: string;
          [key: string]: any;
        };
      };
      attribute_schemas: {
        Row: { id: string; name: string; is_active: boolean };
      };
      item_attributes: {
        Insert: {
          item_id: string;
          schema_id: string;
          raw_value: string;
          normalized_value: string;
          group_key: string;
          confidence?: number;
        };
      };
    };
  };
}

// Price range buckets
const PRICE_RANGES = [
  { max: 50, label: "Under $50", key: "under-50" },
  { max: 100, label: "$50-$100", key: "50-100" },
  { max: 250, label: "$100-$250", key: "100-250" },
  { max: 500, label: "$250-$500", key: "250-500" },
  { max: 1000, label: "$500-$1,000", key: "500-1000" },
  { max: 5000, label: "$1,000-$5,000", key: "1000-5000" },
  { max: Infinity, label: "$5,000+", key: "5000-plus" },
];

function normalizeValue(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function getPriceRangeKey(price: number): { label: string; key: string } {
  for (const range of PRICE_RANGES) {
    if (price < range.max) return { label: range.label, key: range.key };
  }
  return PRICE_RANGES[PRICE_RANGES.length - 1];
}

function generateItemAttributes(
  itemId: string,
  extracted: {
    brand?: string | null;
    price?: number | null;
    category?: string | null;
    retailer?: string | null;
    item_type?: string;
    attributes?: Record<string, unknown>;
  },
  schemas: { id: string; name: string; is_active: boolean }[]
): Database["public"]["Tables"]["item_attributes"]["Insert"][] {
  const attributes: Database["public"]["Tables"]["item_attributes"]["Insert"][] = [];
  const schemaMap = new Map(schemas.map((s) => [s.name, s]));

  // Direct mappings (brand, category, retailer, item_type)
  const directMappings = [
    { schemaName: "brand", value: extracted.brand },
    { schemaName: "category", value: extracted.category },
    { schemaName: "retailer", value: extracted.retailer },
    { schemaName: "item_type", value: extracted.item_type },
  ];

  for (const { schemaName, value } of directMappings) {
    const schema = schemaMap.get(schemaName);
    if (schema && schema.is_active && value) {
      const normalized = normalizeValue(value);
      attributes.push({
        item_id: itemId,
        schema_id: schema.id,
        raw_value: value,
        normalized_value: normalized,
        group_key: `${schemaName}:${normalized}`,
        confidence: 1.0,
      });
    }
  }

  // Price range (computed)
  const priceSchema = schemaMap.get("price_range");
  if (priceSchema && priceSchema.is_active && extracted.price && extracted.price > 0) {
    const range = getPriceRangeKey(extracted.price);
    attributes.push({
      item_id: itemId,
      schema_id: priceSchema.id,
      raw_value: `$${extracted.price.toLocaleString()}`,
      normalized_value: range.key,
      group_key: `price_range:${range.key}`,
      confidence: 1.0,
    });
  }

  // Semantic attributes from extraction (color, material)
  const legacyAttrs = extracted.attributes;
  if (legacyAttrs) {
    for (const { schemaName, value } of [
      { schemaName: "color", value: legacyAttrs.color },
      { schemaName: "material", value: legacyAttrs.material || legacyAttrs.case_material },
    ]) {
      const schema = schemaMap.get(schemaName);
      if (schema && schema.is_active && typeof value === "string") {
        const normalized = normalizeValue(value);
        attributes.push({
          item_id: itemId,
          schema_id: schema.id,
          raw_value: value,
          normalized_value: normalized,
          group_key: `${schemaName}:${normalized}`,
          confidence: 0.85,
        });
      }
    }
  }

  return attributes;
}

serve(async (req) => {
  try {
    // Parse request body
    const { item_id } = await req.json();

    if (!item_id) {
      return new Response(
        JSON.stringify({ success: false, error: "item_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey || !anthropicApiKey) {
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    console.log(`[${item_id}] Starting extraction`);

    // Fetch the item
    const { data: item, error: fetchError } = await supabase
      .from("items")
      .select("*")
      .eq("id", item_id)
      .single();

    if (fetchError || !item) {
      console.error(`[${item_id}] Failed to fetch item:`, fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Item not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!item.source_url) {
      console.error(`[${item_id}] Item has no source_url`);
      await supabase
        .from("items")
        .update({
          extraction_status: 'failed',
          extraction_error: 'No source URL provided',
          extraction_completed_at: new Date().toISOString(),
        } as Database["public"]["Tables"]["items"]["Update"])
        .eq("id", item_id);

      return new Response(
        JSON.stringify({ success: false, error: "No source URL" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update status to 'processing'
    await supabase
      .from("items")
      .update({
        extraction_status: 'processing',
        extraction_started_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["items"]["Update"])
      .eq("id", item_id);

    console.log(`[${item_id}] Fetching content from Jina AI: ${item.source_url}`);

    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), EXTRACTION_TIMEOUT_MS);

    try {
      // Step 1: Fetch content from Jina AI
      const jinaUrl = `${JINA_READER_BASE}${item.source_url}`;
      const jinaHeaders: Record<string, string> = { "Accept": "text/plain" };
      // Authenticated requests get a much higher Jina rate limit; without the
      // key the anonymous tier returns 429 (Too Many Requests) under load.
      const jinaApiKey = Deno.env.get("JINA_API_KEY");
      if (jinaApiKey) {
        jinaHeaders["Authorization"] = `Bearer ${jinaApiKey}`;
      }
      const jinaResponse = await fetch(jinaUrl, {
        headers: jinaHeaders,
        signal: abortController.signal,
      });

      if (!jinaResponse.ok) {
        throw new Error(`Jina AI fetch failed: ${jinaResponse.status} ${jinaResponse.statusText}`);
      }

      const markdown = await jinaResponse.text();

      if (!markdown || markdown.trim().length === 0) {
        throw new Error("No content could be extracted from the URL");
      }

      console.log(`[${item_id}] Content fetched (${markdown.length} chars), calling Claude`);

      // Step 2: Extract structured data using Claude
      const promptContent = EXTRACTION_PROMPT.replace("{{MARKDOWN_CONTENT}}", markdown);

      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 2048,
          // Sonnet 5 enables adaptive thinking by default; disable it so the
          // full token budget stays available for the JSON output.
          thinking: { type: "disabled" },
          messages: [
            {
              role: "user",
              content: promptContent,
            },
          ],
        }),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!claudeResponse.ok) {
        const errorText = await claudeResponse.text();
        throw new Error(`Claude API error: ${claudeResponse.status} ${errorText}`);
      }

      const claudeData = await claudeResponse.json();
      const content = claudeData.content[0];

      if (content.type !== "text") {
        throw new Error("Unexpected response format from Claude");
      }

      // Parse Claude's response. Extract the outermost JSON object so any
      // markdown fences or surrounding prose the model adds are ignored.
      const rawText = content.text;
      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace <= firstBrace) {
        throw new Error(`No JSON object found in Claude response: ${rawText.slice(0, 200)}`);
      }
      const jsonText = rawText.slice(firstBrace, lastBrace + 1);

      const extracted = JSON.parse(jsonText);

      console.log(`[${item_id}] Extraction complete, updating database`);

      // Step 3: Update item with extracted data
      const updateData: Database["public"]["Tables"]["items"]["Update"] = {
        raw_markdown: markdown,
        title: extracted.title,
        brand: extracted.brand,
        price: extracted.price,
        currency: extracted.currency,
        retailer: extracted.retailer,
        image_url: extracted.image_url,
        category: extracted.category,
        tags: extracted.tags,
        item_type: extracted.item_type || "article",
        attributes: extracted.attributes || {},
        confidence_score: extracted.confidence_score,
        extraction_model: CLAUDE_MODEL,
        extraction_status: 'complete',
        extraction_completed_at: new Date().toISOString(),
        last_extracted_at: new Date().toISOString(),
      };

      const { data: updatedItem, error: updateError } = await supabase
        .from("items")
        .update(updateData)
        .eq("id", item_id)
        .select()
        .single();

      if (updateError) {
        console.error(`[${item_id}] Failed to update item:`, updateError);
        throw new Error(`Failed to save extraction results: ${updateError.message}`);
      }

      // Step 4: Create snapshot
      if (updatedItem) {
        const snapshotData: Database["public"]["Tables"]["item_snapshots"]["Insert"] = {
          item_id: updatedItem.id,
          price: extracted.price,
          currency: extracted.currency,
          image_url: extracted.image_url,
          raw_markdown: markdown,
          captured_at: new Date().toISOString(),
        };

        const { data: snapshot } = await supabase
          .from("item_snapshots")
          .insert(snapshotData)
          .select()
          .single();

        // Update item with snapshot reference
        if (snapshot) {
          await supabase
            .from("items")
            .update({ current_snapshot_id: snapshot.id } as any)
            .eq("id", item_id);
        }
      }

      // Step 5: Generate and insert item attributes
      console.log(`[${item_id}] Generating item attributes`);

      const { data: schemas } = await supabase
        .from("attribute_schemas")
        .select("id, name, is_active")
        .eq("is_active", true);

      if (schemas && schemas.length > 0) {
        // Delete existing attributes (for re-extractions)
        await supabase.from("item_attributes").delete().eq("item_id", item_id);

        const attributes = generateItemAttributes(item_id, extracted, schemas);

        if (attributes.length > 0) {
          const { error: attrError } = await supabase.from("item_attributes").insert(attributes);
          if (attrError) {
            console.error(`[${item_id}] Failed to insert attributes:`, attrError);
          } else {
            console.log(`[${item_id}] Inserted ${attributes.length} attributes`);
          }
        }
      }

      console.log(`[${item_id}] ✓ Extraction successful`);

      return new Response(
        JSON.stringify({ success: true, item_id }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    } catch (error) {
      clearTimeout(timeoutId);

      // Check if it was a timeout
      const isTimeout = error instanceof Error && error.name === "AbortError";
      const errorMessage = isTimeout
        ? "Extraction timed out after 90 seconds"
        : error instanceof Error ? error.message : "Unknown error";

      console.error(`[${item_id}] Extraction failed:`, errorMessage);

      // Mark item as failed
      await supabase
        .from("items")
        .update({
          extraction_status: 'failed',
          extraction_error: errorMessage,
          extraction_completed_at: new Date().toISOString(),
        } as Database["public"]["Tables"]["items"]["Update"])
        .eq("id", item_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          timeout: isTimeout
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
