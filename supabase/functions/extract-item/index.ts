import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const JINA_READER_BASE = "https://r.jina.ai/";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const EXTRACTION_TIMEOUT_MS = 90000; // 90 seconds

// Extraction prompt template
const EXTRACTION_PROMPT = `You are a product data extraction assistant. Extract structured product information from the following webpage content.

## Entity Type Detection
Identify what type of item this is and set item_type to a lowercase singular noun
(e.g., "watch", "wine", "book", "sneaker", "camera", "product").

Use your knowledge to determine the most specific accurate type.
Default to "product" only if no better classification fits.

## Core Field Extraction
Extract these fields for ALL item types:
- title: Product name or title (required)
- brand: Brand or manufacturer
- price: Price as a number (no currency symbols)
- currency: Currency code (USD, EUR, GBP, etc.)
- retailer: Website or store name
- image_url: Main product image URL (full URL)
- category: Retail-level category (Electronics, Luxury Goods, etc.)
- tags: Relevant descriptive tags

## Attribute Extraction
Extract all relevant technical specifications and characteristics into the
attributes object. Use your domain knowledge to identify what matters for this
type of item.

### Formatting Rules (IMPORTANT):
- Use snake_case for all keys (e.g., case_size_mm, not caseSize)
- Include units in numeric key names (e.g., weight_kg, power_reserve_hours)
- Use arrays for multi-value fields (e.g., complications: ["date", "chronograph"])
- Use numbers for numeric values, not strings (e.g., 42 not "42mm")
- Omit fields rather than using null for missing data in attributes

## Response Format
Return ONLY valid JSON matching this schema:
{
  "item_type": "string (lowercase singular noun)",
  "title": "string (required)",
  "brand": "string or null",
  "price": "number or null",
  "currency": "string or null",
  "retailer": "string or null",
  "image_url": "string or null (full URL)",
  "category": "string or null",
  "tags": ["array", "of", "strings"] or null,
  "attributes": { /* domain-specific attributes */ },
  "confidence_score": "number 0-1"
}

Be thorough and accurate. The confidence_score should reflect how confident you are in the overall extraction quality.

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
    };
  };
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
      const jinaResponse = await fetch(jinaUrl, {
        headers: { "Accept": "text/plain" },
        signal: abortController.signal,
      });

      if (!jinaResponse.ok) {
        throw new Error(`Jina AI fetch failed: ${jinaResponse.statusText}`);
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

      // Parse Claude's response
      let jsonText = content.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

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
