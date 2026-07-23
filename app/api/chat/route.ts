import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import { ASSISTANT_MODEL } from "@/lib/models";
import {
  listCollectionsForUser,
  getCollectionItemsForUser,
  searchItemsForUser,
  createCollectionForUser,
  addItemsToCollectionForUser,
  removeItemsFromCollectionForUser,
} from "@/lib/assistant-tools";

export const maxDuration = 60;

const MAX_MESSAGES = 40;

const SYSTEM_PROMPT = `You are the Trove Assistant — a concise, terminal-flavored agent inside Open Trove, the user's personal library of items (watches, wine, books, gear...) organized into collections.

You help the user query and organize their Trove in natural language.

## Facts about Trove's data model
- Items are LINKED to collections, not contained in them. An item can be in many collections.
- "Copy to a collection" = add links (add_items_to_collection). This is the default interpretation of "pull into / duplicate into a new list".
- "Move" = add to the destination FIRST, then remove from the source. Always in that order, as two separate steps.
- Removing an item from its last owned collection automatically re-files it to the user's Inbox (the tool result reports this as refiled_to_inbox).
- Only a collection's owner can remove items from it. Editors (shared collections) can view and add, not remove.
- Item prices are in the "price" field (with "currency"); technical specs live in "attributes".

## How to work
- Ground every proposal in real data: call list_collections / get_collection_items / search_items BEFORE proposing changes. Never invent collection or item ids — only use ids returned by tools this conversation.
- Mutations (create_collection, add_items_to_collection, remove_items_from_collection) require the user's explicit approval — the UI shows an approval card. Propose the mutation with a one-line summary of what it will do; do not ask "shall I?" in text AND request approval — the card is the question.
- If the user asks to filter (e.g. "watches over $5k"), do the filtering yourself from tool results and list the matching items (title + price) before proposing what to do with them.
- Agent-created collections default to private visibility; use public only when the user asks to share.
- Be concise. Terminal tone: lowercase-friendly, no emoji, no filler. Short lists over prose. When a task completes, summarize in one or two lines.
- If a tool returns an error or truncated: true, say so plainly.`;

export async function POST(req: Request) {
  const { client, user, error: authError } = await getAuthenticatedServerClient();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const uiMessages = (body.messages ?? []) as UIMessage[];
  const collectionId: string | null = body.collectionId ?? null;

  // Context guard: keep the tail of long conversations
  const messages = uiMessages.slice(-MAX_MESSAGES);

  const userId = user.id;

  const tools = {
    list_collections: tool({
      description:
        "List the user's collections (owned and editor-shared) with id, name, type, visibility, and access level. Call this first when you need collection ids.",
      inputSchema: z.object({}),
      execute: async () => listCollectionsForUser(userId),
    }),

    get_collection_items: tool({
      description:
        "Get the items in one collection (up to 100), including price, currency, category, tags, structured attributes, and the user's notes.",
      inputSchema: z.object({
        collection_id: z.string().describe("Collection id from list_collections"),
      }),
      execute: async ({ collection_id }) =>
        getCollectionItemsForUser(userId, collection_id),
    }),

    search_items: tool({
      description:
        "Search the user's items across all their collections by title, brand, or category substring.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Search text, e.g. 'omega' or 'pinot'"),
      }),
      execute: async ({ query }) => searchItemsForUser(userId, query),
    }),

    create_collection: tool({
      description:
        "Create a new collection, optionally adding existing items to it in the same step. Requires user approval. Use item ids from earlier tool results only.",
      inputSchema: z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        visibility: z
          .enum(["public", "private"])
          .default("private")
          .describe("Default private for assistant-created collections"),
        item_ids: z
          .array(z.string())
          .max(100)
          .optional()
          .describe("Existing item ids to add to the new collection"),
      }),
      needsApproval: true,
      execute: async (input) => createCollectionForUser(client, input),
    }),

    add_items_to_collection: tool({
      description:
        "Add existing items to an existing collection (links them; items stay in their other collections). Requires user approval.",
      inputSchema: z.object({
        collection_id: z.string(),
        item_ids: z.array(z.string()).min(1).max(100),
      }),
      needsApproval: true,
      execute: async (input) => addItemsToCollectionForUser(client, input),
    }),

    remove_items_from_collection: tool({
      description:
        "Remove items from a collection the user OWNS (editors cannot remove). Items removed from their last owned collection are auto re-filed to Inbox. Requires user approval. For a 'move', add to the destination first, then remove.",
      inputSchema: z.object({
        collection_id: z.string(),
        item_ids: z.array(z.string()).min(1).max(100),
      }),
      needsApproval: true,
      execute: async (input) =>
        removeItemsFromCollectionForUser(client, userId, input),
    }),
  };

  const system = collectionId
    ? `${SYSTEM_PROMPT}\n\n## Current context\nThe user is currently viewing collection ${collectionId}. When they say "this collection", they mean that one — fetch its items with get_collection_items if needed.`
    : SYSTEM_PROMPT;

  const result = streamText({
    model: anthropic(ASSISTANT_MODEL),
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
