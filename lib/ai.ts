import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

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
  const message = await anthropic.messages.create({
    model: options?.model || CLAUDE_MODEL,
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

/**
 * Estimate Claude API cost for a request
 * Sonnet 4: $3 per MTok input, $15 per MTok output
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * 3.0;
  const outputCost = (outputTokens / 1_000_000) * 15.0;
  return inputCost + outputCost;
}
