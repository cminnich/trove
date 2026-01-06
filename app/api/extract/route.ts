import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ProductExtractionSchema, type ExtractRequest, type ExtractResponse } from "@/types/extraction";
import { readFileSync } from "fs";
import { join } from "path";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const JINA_READER_BASE = "https://r.jina.ai/";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const LOW_CONFIDENCE_THRESHOLD = 0.7;

// Load extraction prompt from file
const EXTRACTION_PROMPT = readFileSync(
  join(process.cwd(), "prompts", "extraction.txt"),
  "utf-8"
);

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request
    const body = await req.json() as ExtractRequest;

    if (!body.url) {
      return NextResponse.json(
        { success: false, error: "URL is required" } as ExtractResponse,
        { status: 400 }
      );
    }

    // Validate URL format
    let url: URL;
    try {
      url = new URL(body.url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" } as ExtractResponse,
        { status: 400 }
      );
    }

    // Step 1: Fetch content from Jina AI
    const jinaUrl = `${JINA_READER_BASE}${url.toString()}`;
    const jinaResponse = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
      },
    });

    if (!jinaResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch content from Jina AI: ${jinaResponse.statusText}`
        } as ExtractResponse,
        { status: 502 }
      );
    }

    const markdown = await jinaResponse.text();

    if (!markdown || markdown.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "No content could be extracted from the URL" } as ExtractResponse,
        { status: 422 }
      );
    }

    // Step 2: Extract structured data using Claude
    const promptContent = EXTRACTION_PROMPT.replace("{{MARKDOWN_CONTENT}}", markdown);

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: promptContent,
        },
      ],
    });

    // Parse Claude's response
    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json(
        { success: false, error: "Unexpected response format from Claude" } as ExtractResponse,
        { status: 500 }
      );
    }

    // Strip markdown code blocks if present
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      // Remove opening ```json and closing ```
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const extracted = JSON.parse(jsonText);

    // Validate with Zod schema
    const validated = ProductExtractionSchema.parse(extracted);

    // Flag low confidence extractions for manual review
    const needsReview = validated.confidence_score < LOW_CONFIDENCE_THRESHOLD;

    // Return successful response
    const response: ExtractResponse = {
      success: true,
      data: {
        ...validated,
        source_url: url.toString(),
        raw_markdown: markdown,
        extraction_model: CLAUDE_MODEL,
      },
      needs_review: needsReview,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Extraction error:", error);

    // Handle specific error types
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          success: false,
          error: `Claude API error: ${error.message}`
        } as ExtractResponse,
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      } as ExtractResponse,
      { status: 500 }
    );
  }
}
