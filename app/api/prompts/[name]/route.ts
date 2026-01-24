import { NextRequest, NextResponse } from "next/server";
import { loadPrompt } from "@/lib/ai";

// Whitelist of prompts that can be fetched
const ALLOWED_PROMPTS = ["collection_overview.txt"];

/**
 * GET /api/prompts/[name]
 *
 * Returns the contents of a prompt template file.
 * Only whitelisted prompts can be fetched for security.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    // Security: Only allow whitelisted prompts
    if (!ALLOWED_PROMPTS.includes(name)) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    const content = loadPrompt(name);

    return NextResponse.json({
      success: true,
      name,
      content,
    });
  } catch (error) {
    console.error("Failed to load prompt:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load prompt" },
      { status: 500 }
    );
  }
}
