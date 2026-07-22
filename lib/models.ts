/**
 * Central Claude model constant for the Next.js app.
 *
 * Keep in sync with the separately-built targets that can't import from here:
 *   - supabase/functions/extract-item/index.ts (Deno runtime)
 *   - mcp/src/tools/identify-photo.ts (MCP server build)
 */
export const CLAUDE_MODEL = "claude-sonnet-5";
