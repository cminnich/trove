import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { PhotoIdentificationSchema } from "@/types/extraction";
import { CLAUDE_MODEL } from "@/lib/models";

const DEFAULT_MODEL = CLAUDE_MODEL;

/**
 * Load a prompt template from the prompts directory
 */
export function loadPrompt(filename: string): string {
  return readFileSync(join(process.cwd(), "prompts", filename), "utf-8");
}

/**
 * Replace template variables in prompt
 * Example: replaceVars(prompt, { NAME: "Alice", AGE: "30" })
 */
export function replaceVars(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

/**
 * Generate structured data using the Vercel AI SDK's generateObject
 *
 * @param options.model - Claude model to use (default: CLAUDE_MODEL from lib/models)
 * @param options.schema - Zod schema for validation
 * @param options.system - System prompt (optional)
 * @param options.prompt - User prompt content
 * @param options.max_tokens - Maximum tokens for response (default: 2048)
 * @param options.temperature - Temperature setting (default: 1.0)
 * @returns Validated object matching the schema
 */
export async function generateStructuredData<T extends z.ZodTypeAny>({
  model = DEFAULT_MODEL,
  schema,
  system,
  prompt,
  max_tokens = 2048,
  temperature = 1.0,
}: {
  model?: string;
  schema: T;
  system?: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
}): Promise<z.infer<T>> {
  try {
    const result = await generateObject({
      model: anthropic(model),
      schema,
      ...(system ? { system } : {}),
      prompt,
      maxOutputTokens: max_tokens,
      temperature,
      providerOptions: {
        anthropic: {
          // Use tool-based structured output instead of the native beta
          // which can return vague "Invalid request" errors
          structuredOutputMode: "jsonTool",
          // Sonnet 5 turns on adaptive thinking by default; disable it so the
          // full max_tokens budget is available for the structured output.
          thinking: { type: "disabled" },
        },
      },
    });

    return result.object;
  } catch (error: any) {
    // Enhanced error logging for debugging
    console.error('=== AI Generation Error ===');
    console.error('Model:', model);
    console.error('Max Tokens:', max_tokens);
    console.error('Temperature:', temperature);
    console.error('System prompt length:', system?.length || 0);
    console.error('Prompt length:', prompt.length);

    // Estimate token count (rough: 1 token ≈ 4 chars)
    const estimatedTokens = Math.ceil((prompt.length + (system?.length || 0)) / 4);
    console.error('Estimated input tokens:', estimatedTokens);

    if (estimatedTokens > 180000) {
      console.error('⚠️  WARNING: Prompt may exceed context window (~200k tokens)');
    }

    console.error('Error details:', {
      message: error.message,
      statusCode: error.statusCode,
      responseBody: error.responseBody,
      data: error.data,
    });

    // Log the actual request body the SDK sent to the API
    if (error.requestBodyValues) {
      console.error('Request body sent to API:', JSON.stringify(error.requestBodyValues, null, 2));
    }

    // Log first 500 chars of prompt to help debug
    console.error('Prompt preview:', prompt.substring(0, 500));

    throw error;
  }
}

/**
 * Generate markdown text using the Vercel AI SDK's generateText
 *
 * @param options.model - Claude model to use (default: CLAUDE_MODEL from lib/models)
 * @param options.system - System prompt (optional)
 * @param options.prompt - User prompt content
 * @param options.max_tokens - Maximum tokens for response (default: 2048)
 * @param options.temperature - Temperature setting (default: 1.0)
 * @returns Generated text string
 */
export async function generateMarkdown({
  model = DEFAULT_MODEL,
  system,
  prompt,
  max_tokens = 2048,
  temperature = 1.0,
}: {
  model?: string;
  system?: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
}): Promise<string> {
  const result = await generateText({
    model: anthropic(model),
    ...(system ? { system } : {}),
    prompt,
    maxOutputTokens: max_tokens,
    temperature,
    providerOptions: {
      anthropic: {
        // Sonnet 5 enables adaptive thinking by default; disable it to keep the
        // full max_tokens budget for output.
        thinking: { type: "disabled" },
      },
    },
  });

  return result.text;
}

/**
 * Estimate Claude API cost for a request
 * Sonnet 5: $3 per MTok input, $15 per MTok output (standard rates)
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * 3.0;
  const outputCost = (outputTokens / 1_000_000) * 15.0;
  return inputCost + outputCost;
}

/**
 * Identify products from a photo using Claude Vision
 *
 * @param imageBase64 - Base64-encoded image data
 * @param mimeType - Image MIME type (image/jpeg, image/png, etc.)
 * @returns Structured identification with search queries
 */
export async function identifyFromPhoto(
  imageBase64: string,
  mimeType: string
) {
  const prompt = loadPrompt("photo_identification.txt");

  try {
    const result = await generateObject({
      model: anthropic(DEFAULT_MODEL),
      schema: PhotoIdentificationSchema,
      messages: [
        {
          role: "user" as const,
          content: [
            {
              type: "image" as const,
              image: imageBase64,
              mediaType: mimeType,
            },
            { type: "text" as const, text: prompt },
          ],
        },
      ],
      maxOutputTokens: 2048,
      temperature: 1.0,
      providerOptions: {
        anthropic: {
          structuredOutputMode: "jsonTool" as const,
          thinking: { type: "disabled" as const },
        },
      },
    });

    return result.object;
  } catch (error: any) {
    console.error("=== Photo Identification Error ===");
    console.error("Model:", DEFAULT_MODEL);
    console.error("MimeType:", mimeType);
    console.error("Image size (chars):", imageBase64.length);
    console.error("Error details:", {
      message: error.message,
      statusCode: error.statusCode,
    });
    throw error;
  }
}

// ============================================================================
// Legacy API (deprecated but kept for backward compatibility)
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const anthropicLegacy = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CLAUDE_MODEL_LEGACY = CLAUDE_MODEL;

/**
 * @deprecated Use generateStructuredData instead
 * Call Claude with a prompt and parse JSON response
 */
export async function callClaudeJSON<T>(
  prompt: string,
  options?: {
    model?: string;
    max_tokens?: number;
    temperature?: number;
  }
): Promise<{ data: T; raw: string }> {
  const message = await anthropicLegacy.messages.create({
    model: options?.model || CLAUDE_MODEL_LEGACY,
    max_tokens: options?.max_tokens || 2048,
    temperature: options?.temperature || 1.0,
    // @ts-expect-error `thinking` is honored by the API but missing from @anthropic-ai/sdk 0.32 types.
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format from Claude");
  }

  // Extract the outermost JSON object so any markdown fences or surrounding
  // prose the model adds are ignored.
  const firstBrace = content.text.indexOf("{");
  const lastBrace = content.text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in Claude response");
  }
  const jsonText = content.text.slice(firstBrace, lastBrace + 1);

  const data = JSON.parse(jsonText) as T;
  return { data, raw: content.text };
}
