import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

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
 * @param options.model - Claude model to use (default: claude-sonnet-4-5-20250929)
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
  const result = await generateObject({
    model: anthropic(model),
    schema,
    system,
    prompt,
    temperature,
  });

  return result.object;
}

/**
 * Generate markdown text using the Vercel AI SDK's generateText
 *
 * @param options.model - Claude model to use (default: claude-sonnet-4-5-20250929)
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
    system,
    prompt,
    temperature,
  });

  return result.text;
}

/**
 * Estimate Claude API cost for a request
 * Sonnet 4.5: $3 per MTok input, $15 per MTok output
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * 3.0;
  const outputCost = (outputTokens / 1_000_000) * 15.0;
  return inputCost + outputCost;
}

// ============================================================================
// Legacy API (deprecated but kept for backward compatibility)
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const anthropicLegacy = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CLAUDE_MODEL_LEGACY = "claude-sonnet-4-5-20250929";

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
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format from Claude");
  }

  // Strip markdown code blocks if present
  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const data = JSON.parse(jsonText) as T;
  return { data, raw: content.text };
}
