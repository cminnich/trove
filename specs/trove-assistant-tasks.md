# Trove Assistant — Phase 1 (In-App Chat Agent)

## Goal

A chat panel inside the app where an authenticated user can query and organize
their Trove in natural language. Flagship scenario: *"Pull the watches over
$5k from my Watches collection into a new 'Grail Watches' list"* — the agent
searches, proposes, the user confirms, the agent executes.

## Architecture

```
AssistantPanel (useChat, @ai-sdk/react)
   │  POST /api/chat  (cookie auth — NO API key; in-process tools)
   ▼
streamText (ai v6, claude-opus-4-8, stopWhen: stepCountIs(10))
   ├─ READ tools (execute): list_collections, get_collection_items, search_items
   └─ WRITE tools (execute + needsApproval: true — native v6 HITL):
        create_collection { name, description?, visibility, item_ids? }
        add_items_to_collection { collection_id, item_ids }
        remove_items_from_collection { collection_id, item_ids }
   ▼
Tool call streams to client with state 'approval-requested' (part.approval.id)
   ├─ Approve → addToolApprovalResponse({ id, approved: true })
   └─ Deny    → addToolApprovalResponse({ id, approved: false, reason? })
   ▼
sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses
   → resubmit → SERVER executes approved tools (RLS-authed client) → model continues
```

### Review outcomes (subagent, applied)

- Native `needsApproval` HITL instead of client-side execution: single server
  execution path eliminates double-confirm double-execution, multi-card stalls,
  and client-side partial-failure aggregation.
- `await convertToModelMessages(...)` (async in v6 — build-breaking otherwise).
- Auto-resubmit predicate for approvals is
  `lastAssistantMessageIsCompleteWithApprovalResponses` (OR-combined with the
  tool-calls variant).
- Reads include **editor-shared** collections (`collection_access`,
  `access_level='editor'`) so the panel works on shared-collection pages;
  removal is **owner-only** (matches DELETE route) and tool description says so.
- Mutations run on the **authenticated RLS client** (same as internal routes);
  reads may use service-role only after an explicit access check
  (v1 pattern) — `get_collection_items` checks access BEFORE fetching.
- Moves: system prompt mandates add-first-then-remove (the remove path has an
  Inbox safety net that re-files orphaned items — surfaced in tool output).
- `create_collection` takes explicit `visibility` (default `private` for
  agent-created collections; shown on the approval card).
- Message-count guard on /api/chat (keep last 40 messages).

### Design decisions

- **In-process tools, not v1 HTTP + API key.** User is already cookie-authed;
  the v1 API is the surface for *external* agents. Read tools query Supabase
  directly (service-role client + explicit `owner_id`/access scoping, same
  patterns as v1 routes).
- **Human-in-the-loop via client-side tools.** Write tools have no `execute` on
  the server — AI SDK v6 streams the tool call to the client; the panel renders
  a confirm card; on Confirm the client calls the existing internal REST routes
  (already tested, already enforce auth via RLS/session), then returns the
  outcome via `addToolResult`. The agent never mutates without a click.
- **Copy vs move:** items are *linked* to collections. System prompt instructs:
  default to copy (add links); for "move", propose add + remove explicitly.
- **Model:** `claude-opus-4-8` (tool-use quality). No `temperature`, no
  `thinking` param (provider 3.0.31 only knows enabled/budget shape, which
  400s on opus-4-8; omitting = thinking off, valid).
- **Result compaction:** tool results trim items to
  `{id, title, brand, price, currency, category, item_type, tags}` (+
  optional `attributes` on get_collection_items), cap 100 items, so context
  stays manageable.
- **Collection context:** panel sends `collectionId` when pathname matches
  `/collections/[id]`; route injects "user is currently viewing collection X"
  into the system prompt.

## Files

| File | Action |
|---|---|
| `lib/assistant-tools.ts` | NEW — read-tool data access (userId-scoped) + shared item-trimming helper |
| `app/api/chat/route.ts` | NEW — auth, tool defs (zod), streamText, `toUIMessageStreamResponse()` |
| `app/components/Assistant/AssistantPanel.tsx` | NEW — useChat panel, message parts renderer, ConfirmCard |
| `app/components/Assistant/AssistantWrapper.tsx` | NEW — client wrapper: auth check (supabase client), hide on `/`, floating toggle button |
| `app/layout.tsx` | EDIT — mount `<AssistantWrapper />` |
| `lib/models.ts` | EDIT — add `ASSISTANT_MODEL = "claude-opus-4-8"` |
| `tests/unit/assistant-tools.test.ts` | NEW — trimming/shape unit tests |
| `package.json` | `npm i @ai-sdk/react` |

## Tasks

1. **Tools + data access** (`lib/assistant-tools.ts`)
   - `trimItem(item)` — pure, unit-testable
   - `listCollectionsForUser(supabase, userId)` — owned collections id/name/type/visibility/item_count
   - `getCollectionItems(supabase, userId, collectionId)` — ownership check → items (trimmed + attributes + notes)
   - `searchItems(supabase, userId, q, filters?)` — reuse v1 search shape (collection-membership scoping, sanitized ilike)
2. **Chat route** (`app/api/chat/route.ts`)
   - `getAuthenticatedServerClient()` → 401 if no user
   - zod `inputSchema` per tool; write tools defined WITHOUT execute
   - `streamText({ model: anthropic(ASSISTANT_MODEL), system, messages: convertToModelMessages(messages), tools, stopWhen: stepCountIs(10) })`
   - System prompt: persona, copy-vs-move semantics, "search before proposing",
     "never invent item ids", concise Terminal-style tone
3. **UI** (`AssistantPanel` + `AssistantWrapper` + layout mount)
   - `useChat` + `DefaultChatTransport({ api: '/api/chat', body: { collectionId } })`
   - `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`
   - Render parts: `text`; `tool-*` read tools → subtle "searched…" line;
     write tools with `state === 'input-available'` → ConfirmCard
     (name/description/N items) with Confirm / Cancel
   - Confirm handler: create → `POST /api/collections` (grab id) → add items;
     add → per-item POST; remove → per-item DELETE; then
     `addToolResult({ tool, toolCallId, output })`
   - Terminal Noir: `bg-void`, `border-slate-800`, `font-mono`, `text-open-green`
     accents; slide-over on desktop, full-height sheet on mobile; z-index above
     BottomTabBar
4. **Verify + ship**
   - `npm run build`, `npx vitest run tests/unit`
   - Commit + push (Vercel deploys)

## Out of scope (Phase 2+)

- Web product search / shopping tool (reuse `lib/product-search.ts`)
- Chat persistence across sessions
- Streaming into collection pages ("ask about this collection" affordance)
- Rate limiting on /api/chat
