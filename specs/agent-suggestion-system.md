# Feature: AI Agent Suggestion System

**Created**: 2026-01-11
**Status**: Planning
**Complexity**: High
**Estimated Scope**: 2-3 weeks for Phase 1

## Overview

An autonomous AI agent integrated into Trove that maintains "Collection Intelligence" by analyzing content and providing two key capabilities:

1. **Smart Organization**: Intelligently suggests which collection(s) items from the user's Inbox should be added to, with explanatory reasoning
2. **Collection Insights**: Automatically maintains fresh, AI-generated overviews and insights for each collection as content evolves

The agent runs as a Supabase Edge Function (Deno runtime) triggered by database webhooks, ensuring unlimited execution time without Vercel timeout constraints. It uses Claude's Agent SDK with MCP access to Supabase, enforcing strict user data isolation through JWT-scoped authentication and RLS policies.

## Success Criteria

**Core Functionality**:
- [ ] After each extraction completes, agent automatically queues via Next.js API and processes in Supabase Edge Function
- [ ] Agent generates up to 5 suggestions for items in Inbox that should be added to specific collections
- [ ] Agent regenerates collection overview/insight if null or stale (7+ days old AND multiple items added)
- [ ] Suggestions appear in UI within 30 seconds of extraction completing
- [ ] Collection insights displayed in collection view when available

**User Experience**:
- [ ] User can approve, reject, or edit suggestions before adding to collections
- [ ] Suggestion UI shows item preview, agent reasoning, and target collection(s)
- [ ] Idempotency: approving suggestion for item already in collection succeeds gracefully (no error)
- [ ] UI filters out invalid suggestions (item already moved) before displaying notifications
- [ ] Unique constraint prevents duplicate suggestions for same (item, collection) pair

**Control & Security**:
- [ ] Agent can be enabled/disabled globally by user
- [ ] User can adjust suggestion aggressiveness (conservative/balanced/exploratory)
- [ ] Failed agent runs can be manually retried by user
- [ ] Security tests confirm zero cross-user data leakage via Edge Function + MCP

## User Journey

### Primary Flow: Successful Suggestion
1. User extracts a URL to Collection A
2. Extraction completes successfully, item added to Collection A
3. Agent task queued in background to analyze user's Inbox
4. Notification bell shows spinner indicating agent is processing
5. Within 30 seconds, agent completes analysis
6. Toast notification appears: "3 new suggestions ready"
7. Notification bell shows badge with count: "3"
8. User clicks notification bell, sees suggestion inbox
9. Each suggestion shows:
   - Preview of item from Inbox (title, excerpt)
   - Agent reasoning ("This article about React patterns fits well with your 'Frontend Dev' collection")
   - Target collection ("Add to: Frontend Dev")
10. User clicks "Approve" - item moved from Inbox to Frontend Dev collection
11. Suggestion marked as completed, count decrements
12. User clicks "Reject" on another suggestion - dismissed
13. User clicks "Edit" on third suggestion - modal opens with item content, user modifies, then approves

### Alternative Flow: Agent Suggests Across Multiple Collections
1. User extracts article about "TypeScript Performance Optimization"
2. Agent analyzes and generates 3 suggestions:
   - Suggest adding this item to "TypeScript" collection
   - Suggest adding this item to "Performance" collection
   - Suggest adding different Inbox item about "React Hooks" to "Frontend Dev" collection
3. User sees all 3 suggestions in notification inbox
4. User can approve same item to multiple collections
5. User can approve different items to different collections

### Alternative Flow: Collection Insights Regeneration
1. User has been actively adding items to "TypeScript" collection over past 2 weeks
2. Collection's `ai_insight` field was last updated 10 days ago
3. User extracts a new TypeScript article
4. Agent runs and detects: insight is stale (>7 days old) AND collection has grown significantly
5. Agent regenerates collection overview based on current items
6. Updated insight stored in collection's `ai_insight` field with new timestamp
7. Next time user views collection, they see fresh AI-generated summary
8. No user notification (transparent background maintenance)

### Edge Cases

**Case 1: Agent Failure**
- Agent API call times out or returns error
- User sees no toast notification
- Notification bell shows error icon (red dot)
- User clicks bell, sees "Suggestions failed to generate" message
- "Retry suggestions" button available
- User clicks retry, agent re-runs with same inputs

**Case 2: Extraction Completes but Inbox is Empty**
- User extracts item to specific collection
- Inbox has no items
- Agent runs but finds nothing to suggest
- No notification shown (silent success)
- Logged as successful agent run with 0 suggestions

**Case 3: Collection Deleted While Suggestions Pending**
- Agent suggests adding Item X to Collection A
- User deletes Collection A before reviewing suggestions
- Suggestion automatically cascade deleted from database
- Suggestion disappears from notification inbox

**Case 4: Inbox Item Deleted While Suggestion Pending**
- Agent suggests adding Item X from Inbox to Collection A
- User manually deletes Item X from Inbox
- Suggestion automatically cascade deleted
- Suggestion disappears from notification inbox

**Case 5: Private Collection**
- User marks Collection A as "private"
- Agent analyzes user collections but excludes Collection A
- Agent never suggests adding items to Collection A
- Collection A data not included in agent context

**Case 6: User Disables Agent**
- User toggles "Enable AI Suggestions" to OFF in settings
- Extractions complete normally
- Agent tasks not queued
- No suggestions generated

**Case 7: Race Condition - Item Moved Before Approval**
- Agent suggests moving Item X from Inbox to Collection A
- User manually drags Item X to Collection A before reviewing suggestion
- User later clicks "Approve" on pending suggestion
- API checks if item already in collection
- Since item is already there, API treats approval as successful (idempotent)
- Suggestion marked as approved, no error shown to user
- Alternative: Before showing notification badge count, filter out invalid suggestions

**Case 8: Duplicate Suggestion Prevention**
- Agent runs twice for same user (e.g., retry)
- Agent attempts to create suggestion: Item X → Collection A
- Database unique constraint on (item_id, target_collection_id) prevents duplicate
- Agent logs duplicate prevention, continues with other suggestions
- User only sees one suggestion per (item, collection) pair

## Technical Implementation

### Architecture Decisions

#### Decision 1: Agent Trigger Timing
- **Options Considered**:
  - After each extraction completes
  - Scheduled background job (e.g., nightly)
  - User-initiated only
  - Hybrid: immediate + scheduled
- **Chosen**: After each extraction completes
- **Rationale**: Provides immediate value when user is most engaged. User just extracted content and is thinking about organization. Suggestions are most relevant in this context.
- **Tradeoffs**: More API calls (cost) vs. better UX and relevance. Mitigated by max 5 suggestions per run.

#### Decision 2: Agent Autonomy Level
- **Options Considered**:
  - Suggestions only (require approval)
  - Auto-add with undo
  - Configurable per collection
  - Confidence-based (auto-add high confidence, suggest low confidence)
- **Chosen**: Suggestions only - always require approval
- **Rationale**: Preserves user control and trust. Users may not want automated changes to their collections. Approval step allows learning agent reasoning.
- **Tradeoffs**: Extra clicks required vs. user confidence and control. Can revisit auto-add in future based on feedback.

#### Decision 3: Agent Context Scope
- **Options Considered**:
  - Current collection only
  - Current collection + Inbox
  - All user collections + overviews
  - User-provided context only
- **Chosen**: All user collections (metadata + overviews) + Inbox items
- **Rationale**: Agent needs full picture to suggest items across all collections. Collection overviews provide efficient summary without exposing all item details. Respects privacy via "private" collection flag.
- **Tradeoffs**: Larger context (cost/latency) vs. better cross-collection suggestions. Mitigated by using overviews instead of full items.

#### Decision 4: Execution Environment - Supabase Edge Functions
- **Options Considered**:
  - Next.js API routes with background jobs
  - Supabase Edge Functions (Deno runtime)
  - Standalone long-running server
  - AWS Lambda / Vercel Functions
- **Chosen**: Supabase Edge Functions triggered by database webhooks
- **Rationale**:
  - **No timeout limits**: Vercel has 10s (Hobby) / 60s (Pro) function limits. Agent analysis can take 30-60s.
  - **Native Supabase integration**: Direct database access, built-in JWT auth validation
  - **Event-driven**: Database webhook fires when `agent_runs` row inserted, no polling required
  - **Deno runtime**: Modern, secure, TypeScript-native environment
  - **Cost-effective**: Only runs when triggered, scales automatically
- **Tradeoffs**: Separate deployment from Next.js app vs. unlimited execution time. Trade-off strongly favors Edge Functions for this use case.

**Architecture Flow**:
```
Next.js API (POST /api/v1/agent/queue)
    ↓
Insert row into agent_runs table (status: 'queued')
    ↓
Database Webhook triggers on agent_runs INSERT
    ↓
Webhook calls Supabase Edge Function with agent_run_id
    ↓
Edge Function processes agent logic (30-60s, no timeout)
    ↓
Edge Function updates agent_run status to 'completed' or 'failed'
```

#### Decision 5: Content Sources
- **Options Considered**:
  - Web search for new content
  - User's Inbox items
  - Links from existing collection items
  - LLM-generated synthetic items
- **Chosen**: User's Inbox items only (Phase 1)
- **Rationale**: Simplest useful feature. Helps users organize content they've already extracted. No need for web access or synthetic generation. Proven value before expanding scope.
- **Tradeoffs**: Limited to existing content vs. focused, achievable Phase 1. Can add other sources later.

### Data Model

#### New Table: suggestions

```sql
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  target_collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,

  -- Suggestion content
  reasoning TEXT NOT NULL, -- Agent's explanation for suggestion
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00, optional

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes
  INDEX idx_suggestions_user_status (user_id, status),
  INDEX idx_suggestions_item (item_id),
  INDEX idx_suggestions_collection (target_collection_id),
  INDEX idx_suggestions_agent_run (agent_run_id),

  -- Unique constraint to prevent duplicate suggestions
  UNIQUE (item_id, target_collection_id)
);

-- RLS Policies
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suggestions"
  ON suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert suggestions"
  ON suggestions FOR INSERT
  WITH CHECK (true); -- Service role only

CREATE POLICY "Users can delete their own suggestions"
  ON suggestions FOR DELETE
  USING (auth.uid() = user_id);
```

#### New Table: agent_runs

```sql
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Trigger context
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('extraction', 'manual_retry')),
  trigger_item_id UUID REFERENCES items(id) ON DELETE SET NULL, -- Item that triggered extraction

  -- Execution details
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Input/output
  input_context JSONB, -- Collections analyzed, inbox size, etc.
  suggestions_generated INT DEFAULT 0,
  error_message TEXT,

  -- Cost tracking
  tokens_used INT,
  api_cost_cents INT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes
  INDEX idx_agent_runs_user (user_id),
  INDEX idx_agent_runs_status (status),
  INDEX idx_agent_runs_created (created_at)
);

-- RLS Policies
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent runs"
  ON agent_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage agent runs"
  ON agent_runs FOR ALL
  USING (true); -- Service role only
```

#### Modified Table: collections

```sql
-- Add columns for private collections and AI-generated insights
ALTER TABLE collections
  ADD COLUMN is_private BOOLEAN DEFAULT FALSE,
  ADD COLUMN is_inbox BOOLEAN DEFAULT FALSE, -- Identifies the special Inbox collection
  ADD COLUMN ai_insight TEXT, -- AI-generated collection summary/overview
  ADD COLUMN ai_insight_generated_at TIMESTAMP WITH TIME ZONE, -- When insight was last updated
  ADD COLUMN items_count_at_insight INT; -- How many items existed when insight was generated

-- Create unique constraint to ensure only one Inbox per user
CREATE UNIQUE INDEX idx_collections_user_inbox
  ON collections (user_id)
  WHERE is_inbox = TRUE;

-- Update RLS policy to exclude private collections from agent context
-- (handled in application logic, not RLS)

COMMENT ON COLUMN collections.ai_insight IS 'AI-generated overview/summary of collection contents, maintained by agent';
COMMENT ON COLUMN collections.ai_insight_generated_at IS 'Timestamp of last insight generation, used to determine staleness';
COMMENT ON COLUMN collections.items_count_at_insight IS 'Number of items in collection when insight was generated, used to detect significant growth';
```

#### Modified Table: users

```sql
-- Add columns for agent preferences
ALTER TABLE users
  ADD COLUMN agent_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN agent_aggressiveness TEXT DEFAULT 'balanced'
    CHECK (agent_aggressiveness IN ('conservative', 'balanced', 'exploratory'));
```

#### Data Flow

**Phase 1: Queueing (Next.js API)**
```
User extracts URL
    ↓
Extraction completes → Item added to target collection
    ↓
Next.js API: POST /api/v1/agent/queue
    ↓
Insert row into agent_runs table:
  - user_id (from JWT session)
  - trigger_type: 'extraction'
  - trigger_item_id: extracted item ID
  - status: 'queued'
    ↓
Return 200 to client immediately
```

**Phase 2: Webhook Trigger (Database → Edge Function)**
```
Database webhook fires on agent_runs INSERT
    ↓
Webhook payload: agent_run_id, user_id
    ↓
Call Supabase Edge Function: process-agent-run
    ↓
Edge Function receives: agent_run_id
```

**Phase 3: Agent Processing (Supabase Edge Function)**
```
Edge Function updates agent_run status: 'running'
    ↓
Edge Function fetches user context via MCP:
  - User's Inbox items (id, title, content, url, collection_id WHERE is_inbox=true)
  - User's collections (id, name, ai_insight, ai_insight_generated_at, items_count_at_insight, current_item_count)
  - User's agent preferences (aggressiveness)
  - Exclude private collections (is_private=true)
    ↓
Edge Function checks each collection for staleness:
  IF ai_insight IS NULL OR
     (ai_insight_generated_at < NOW() - INTERVAL '7 days' AND current_item_count > items_count_at_insight + 5)
  THEN regenerate_collection_insight(collection_id)
    ↓
For collection insight regeneration:
  - IF ai_insight EXISTS: Use it as context
  - IF ai_insight IS NULL: Fetch 5 most recent items (title + content snippet) as fallback context
  - Call Claude API to generate new insight based on current items
  - Update collection: ai_insight, ai_insight_generated_at, items_count_at_insight
    ↓
Agent analyzes Inbox items with Claude API:
  - System prompt: "You are helping organize content into collections"
  - Context: Collection insights (fresh or regenerated) + Inbox items to evaluate
  - Output: Structured JSON with up to 5 suggestions
    ↓
Edge Function creates suggestion records in database:
  - Use INSERT ... ON CONFLICT (item_id, target_collection_id) DO NOTHING
  - Unique constraint prevents duplicates
    ↓
Edge Function updates agent_run:
  - status: 'completed'
  - suggestions_generated: count
  - completed_at: NOW()
  - tokens_used, api_cost_cents
```

**Phase 4: User Interaction (Next.js Client)**
```
Client polls GET /api/v1/suggestions (every 30s)
    ↓
Before showing notifications:
  Filter suggestions where item is already in target collection (validation check)
    ↓
User notified via:
  - Notification bell badge count (valid suggestions only)
  - Toast notification: "N new suggestions ready"
    ↓
User reviews suggestions:
  - Approve → API checks if item already in collection (idempotent)
    → If already present: Mark suggestion approved, return success
    → If not present: Move item from Inbox to collection, mark approved
  - Reject → Suggestion marked rejected
  - Edit → Item updated, then moved to collection
```

### API Design

#### New Endpoint: POST /api/v1/agent/queue

**Purpose**: Queue agent task after extraction completes (inserts row into agent_runs, triggers webhook)
**Auth**: Requires valid user session (JWT)
**Execution**: Synchronous insert only, actual processing happens asynchronously in Edge Function

**Request**:
```json
{
  "trigger_type": "extraction",
  "trigger_item_id": "uuid-of-extracted-item"
}
```

**Implementation**:
```typescript
// Insert row into agent_runs table
const { data, error } = await supabase
  .from('agent_runs')
  .insert({
    user_id: session.user.id,
    trigger_type: 'extraction',
    trigger_item_id: body.trigger_item_id,
    status: 'queued'
  })
  .select()
  .single();

// Database webhook automatically triggers Edge Function
// Return immediately to client without waiting for processing
```

**Response** (200):
```json
{
  "agent_run_id": "uuid",
  "status": "queued",
  "estimated_completion": "2026-01-11T12:34:00Z"
}
```

**Errors**:
- `401`: Unauthorized (no valid session)
- `403`: Agent disabled for user
- `429`: Rate limit exceeded (too many agent runs)

---

#### New Endpoint: GET /api/v1/suggestions

**Purpose**: Fetch pending suggestions for user
**Auth**: Requires valid user session (JWT)

**Request**:
```
GET /api/v1/suggestions?status=pending&limit=50
```

**Response** (200):
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "item": {
        "id": "uuid",
        "title": "React Performance Patterns",
        "content": "...",
        "url": "https://example.com",
        "created_at": "2026-01-11T12:00:00Z"
      },
      "target_collection": {
        "id": "uuid",
        "name": "Frontend Dev"
      },
      "reasoning": "This article discusses React performance optimization techniques that align with your Frontend Dev collection's focus on modern web development practices.",
      "confidence_score": 0.87,
      "status": "pending",
      "created_at": "2026-01-11T12:05:00Z"
    }
  ],
  "total_count": 12,
  "pending_count": 12
}
```

**Errors**:
- `401`: Unauthorized

---

#### New Endpoint: POST /api/v1/suggestions/:id/approve

**Purpose**: Approve suggestion and move item to collection (with idempotency for race conditions)
**Auth**: Requires valid user session (JWT)

**Request**:
```json
{
  "edited_content": "..." // Optional: if user edited item before approving
}
```

**Implementation** (idempotency logic):
```typescript
// 1. Fetch suggestion with item and collection
const suggestion = await fetchSuggestionWithDetails(suggestionId, userId);

// 2. Check if item is already in target collection
const itemInCollection = await checkItemInCollection(
  suggestion.item_id,
  suggestion.target_collection_id
);

if (itemInCollection) {
  // Idempotent: Item already moved (race condition), treat as success
  await markSuggestionApproved(suggestionId);
  return { success: true, already_in_collection: true };
}

// 3. Move item to collection
await moveItemToCollection(suggestion.item_id, suggestion.target_collection_id);

// 4. Mark suggestion as approved
await markSuggestionApproved(suggestionId);
```

**Response** (200):
```json
{
  "success": true,
  "item_id": "uuid",
  "collection_id": "uuid",
  "suggestion_id": "uuid",
  "already_in_collection": false // true if item was already there (race condition handled)
}
```

**Errors**:
- `401`: Unauthorized
- `404`: Suggestion not found or doesn't belong to user

---

#### New Endpoint: POST /api/v1/suggestions/:id/reject

**Purpose**: Reject suggestion and mark as dismissed
**Auth**: Requires valid user session (JWT)

**Response** (200):
```json
{
  "success": true,
  "suggestion_id": "uuid"
}
```

**Errors**:
- `401`: Unauthorized
- `404`: Suggestion not found

---

#### New Endpoint: POST /api/v1/agent/retry/:agent_run_id

**Purpose**: Manually retry failed agent run
**Auth**: Requires valid user session (JWT)

**Response** (200):
```json
{
  "agent_run_id": "uuid",
  "status": "queued"
}
```

**Errors**:
- `401`: Unauthorized
- `404`: Agent run not found
- `400`: Agent run not in failed state

---

#### Modified Endpoint: POST /api/v1/extract

**Changes**: After successful extraction, queue agent task

**New behavior**:
```typescript
// After extraction succeeds
await queueAgentTask({
  user_id: session.user.id,
  trigger_type: 'extraction',
  trigger_item_id: extractedItem.id
});
```

---

#### New Endpoint: GET /api/v1/users/me/settings

**Purpose**: Get user agent preferences
**Auth**: Requires valid user session (JWT)

**Response** (200):
```json
{
  "agent_enabled": true,
  "agent_aggressiveness": "balanced"
}
```

---

#### New Endpoint: PATCH /api/v1/users/me/settings

**Purpose**: Update user agent preferences
**Auth**: Requires valid user session (JWT)

**Request**:
```json
{
  "agent_enabled": false,
  "agent_aggressiveness": "conservative"
}
```

**Response** (200):
```json
{
  "agent_enabled": false,
  "agent_aggressiveness": "conservative"
}
```

---

---

#### Supabase Edge Function: process-agent-run (Internal)

**Purpose**: Process agent run (triggered by database webhook)
**Runtime**: Deno (Supabase Edge Function)
**Trigger**: Database webhook on `agent_runs` INSERT
**Location**: `supabase/functions/process-agent-run/index.ts`

**Webhook Payload**:
```json
{
  "type": "INSERT",
  "table": "agent_runs",
  "record": {
    "id": "uuid",
    "user_id": "uuid",
    "status": "queued",
    "trigger_type": "extraction",
    "trigger_item_id": "uuid"
  }
}
```

**Processing Steps**:
1. Extract `agent_run_id` and `user_id` from webhook payload
2. Update agent_run status to 'running'
3. Generate user-scoped JWT token for MCP access
4. Fetch user context via MCP tools
5. Check collection staleness and regenerate insights if needed
6. Analyze Inbox items and generate suggestions
7. Insert suggestions into database (with duplicate prevention)
8. Update agent_run status to 'completed' or 'failed'

**Error Handling**:
- Catch all errors and update agent_run status to 'failed'
- Log error message to agent_run.error_message
- Ensure Edge Function always completes (never hangs)

**Timeout**: No timeout limit (Edge Function advantage over Vercel)

---

#### MCP Tools (Internal API for Agent)

**Tool: get_user_inbox**
- **Purpose**: Fetch all items in user's Inbox collection (identified by is_inbox=true)
- **Auth**: Scoped to user_id from JWT token
- **Query**: `SELECT * FROM items WHERE collection_id IN (SELECT id FROM collections WHERE user_id = $user_id AND is_inbox = true)`
- **Returns**: Array of items (id, title, content, url, created_at)

**Tool: get_user_collections**
- **Purpose**: Fetch all user collections with AI insights and metadata
- **Auth**: Scoped to user_id from JWT token
- **Filters**: Excludes private collections (is_private=true), excludes Inbox (is_inbox=true)
- **Query**: Includes current item count via JOIN/subquery
- **Returns**: Array of collections (id, name, ai_insight, ai_insight_generated_at, items_count_at_insight, current_item_count)
- **Fallback**: If ai_insight is NULL, fetch 5 most recent items for context generation

**Tool: get_collection_recent_items**
- **Purpose**: Fetch recent items from a collection for context (fallback when no ai_insight)
- **Auth**: Scoped to user_id from JWT token
- **Query**: `SELECT title, content FROM items WHERE collection_id = $collection_id ORDER BY created_at DESC LIMIT 5`
- **Returns**: Array of recent items (title, content snippet)

**Tool: create_suggestion**
- **Purpose**: Create a new suggestion record (with duplicate prevention)
- **Auth**: Scoped to user_id from JWT token
- **Input**: item_id, target_collection_id, reasoning, confidence_score, agent_run_id
- **Query**: `INSERT ... ON CONFLICT (item_id, target_collection_id) DO NOTHING`
- **Returns**: Suggestion ID (or null if duplicate)

**Tool: update_collection_insight**
- **Purpose**: Update collection's AI-generated insight
- **Auth**: Scoped to user_id from JWT token
- **Input**: collection_id, ai_insight, items_count_at_insight
- **Updates**: ai_insight, ai_insight_generated_at (NOW()), items_count_at_insight
- **Returns**: Success boolean

### State Management

**Client State** (React/Zustand):
- `suggestions: Suggestion[]` - Array of pending suggestions
- `suggestionCount: number` - Badge count for notification bell
- `agentProcessing: boolean` - Whether agent is currently running
- `agentError: AgentRunError | null` - Error state if agent failed

**Server State** (Database):
- `suggestions` table - All suggestions (pending/approved/rejected)
- `agent_runs` table - Audit log of all agent executions
- User preferences in `users` table

**Synchronization**:
- Poll `/api/v1/suggestions` every 30 seconds when user is active
- WebSocket (future enhancement) for real-time suggestion delivery
- Optimistic updates: when approving suggestion, immediately move to approved state in UI

**Optimistic Updates**:
- **Approve**: Immediately remove from pending list, show success toast
- **Reject**: Immediately remove from pending list
- **Edit**: Open modal immediately, save on confirm
- If API call fails, revert optimistic update and show error

### Security

**Authentication**:
- All API endpoints require valid Next-Auth session
- JWT token contains user_id claim
- MCP server validates JWT on every tool call

**Authorization**:
- Agent can only access data for authenticated user (via JWT user_id)
- Row-Level Security (RLS) policies enforce user_id = auth.uid() on all tables
- MCP tools explicitly filter by user_id from JWT
- Private collections excluded from agent context in application logic

**Input Validation**:
- All API inputs validated with Zod schemas
- Item IDs validated to belong to authenticated user before operations
- Collection IDs validated to belong to authenticated user
- Maximum suggestion reasoning length: 500 characters
- Maximum suggestions per agent run: 5

**Data Sanitization**:
- Agent reasoning sanitized to prevent XSS (escaped before rendering)
- User content escaped before passing to agent (prevent prompt injection)
- URL validation before extraction

**Rate Limiting**:
- Max 1 agent run per user per minute
- Max 10 agent runs per user per hour
- Enforced at API layer before queueing task

**Sensitive Data**:
- Agent logs do not include full item content (only IDs and metadata)
- JWT tokens never logged
- API costs tracked per user but not exposed in UI

**Security Testing Requirements**:
1. **Unit Tests**: Agent with User A token attempts to access User B data → Must fail
2. **Integration Tests**: Two users extract simultaneously, verify suggestions don't cross
3. **Penetration Testing**: Attempt token manipulation, user_id spoofing, RLS bypass
4. **Code Review**: Dedicated security review of all JWT validation and RLS policies

### Performance

**Expected Load**:
- Average: 10 extractions/hour/user → 10 agent runs/hour/user
- Peak: 100 extractions/hour across all users → 100 agent runs/hour
- Each agent run: 1-5 suggestions

**Caching Strategy**:
- Collection overviews cached for 1 hour (TTL)
- User preferences cached in memory for session duration
- Inbox items fetched fresh on each agent run (no cache)

**Database Indexes**:
- `suggestions(user_id, status)` - For fetching pending suggestions
- `suggestions(item_id)` - For cascade deletion
- `suggestions(target_collection_id)` - For cascade deletion
- `agent_runs(user_id, created_at)` - For user history and analytics

**Query Optimization**:
- Eager load item and collection when fetching suggestions (JOIN)
- Limit suggestions query to 50 most recent
- Pagination for agent run history

**Bundle Impact**:
- Agent SDK: ~50KB (tree-shaken)
- MCP client: ~30KB
- UI components: ~20KB
- Total: ~100KB additional bundle size

**Lazy Loading**:
- Agent SDK loaded only when agent task queued (server-side)
- Suggestion UI components lazy loaded when notification bell clicked

**Performance SLA**:
- Agent completes within 30 seconds of extraction
- API endpoints respond within 500ms (p95)
- UI updates within 100ms of user action

## UI/UX Design

### Components

#### New Component: SuggestionInbox
- **Purpose**: Display list of pending suggestions in notification dropdown
- **Props**:
  - `suggestions: Suggestion[]`
  - `onApprove: (id: string) => void`
  - `onReject: (id: string) => void`
  - `onEdit: (id: string) => void`
- **Location**: `app/components/SuggestionInbox.tsx`
- **Features**:
  - Virtual scrolling for large suggestion lists
  - Empty state: "No pending suggestions"
  - Loading state: Skeleton loaders
  - Error state: Retry button

#### New Component: SuggestionCard
- **Purpose**: Individual suggestion item with preview and actions
- **Props**:
  - `suggestion: Suggestion`
  - `onApprove: () => void`
  - `onReject: () => void`
  - `onEdit: () => void`
- **Location**: `app/components/SuggestionCard.tsx`
- **Layout**:
  ```
  ┌─────────────────────────────────────────┐
  │ [Icon] Item Title                       │
  │ Brief content excerpt...                │
  │                                         │
  │ 💡 Agent reasoning: "This article..."  │
  │ 📁 Add to: Collection Name              │
  │                                         │
  │ [Approve] [Edit] [Reject]               │
  └─────────────────────────────────────────┘
  ```

#### New Component: SuggestionEditModal
- **Purpose**: Allow editing item content before approving
- **Props**:
  - `suggestion: Suggestion`
  - `onSave: (content: string) => void`
  - `onCancel: () => void`
- **Location**: `app/components/SuggestionEditModal.tsx`
- **Features**:
  - Textarea for content editing
  - Preview tab
  - Save/Cancel buttons

#### New Component: NotificationBell
- **Purpose**: Header icon showing suggestion count and status
- **Props**:
  - `count: number`
  - `isProcessing: boolean`
  - `hasError: boolean`
  - `onClick: () => void`
- **Location**: `app/components/NotificationBell.tsx`
- **States**:
  - **Idle**: Bell icon, no badge
  - **Has suggestions**: Bell icon with count badge (e.g., "3")
  - **Processing**: Bell icon with spinner
  - **Error**: Bell icon with red dot indicator

#### New Component: AgentSettings
- **Purpose**: User settings for agent preferences
- **Props**:
  - `enabled: boolean`
  - `aggressiveness: string`
  - `onUpdate: (settings) => void`
- **Location**: `app/components/AgentSettings.tsx`
- **Controls**:
  - Toggle: "Enable AI Suggestions"
  - Radio group: Aggressiveness (Conservative / Balanced / Exploratory)
  - Description text explaining each level

#### New Component: CollectionSuggestionsTab
- **Purpose**: Dedicated tab in collection view showing suggestions
- **Props**:
  - `collectionId: string`
  - `suggestions: Suggestion[]`
- **Location**: `app/components/CollectionSuggestionsTab.tsx`
- **Features**:
  - Filter to show only suggestions for this collection
  - Empty state: "No suggestions for this collection"

#### Modified Component: NotificationToast
- **Changes**: Add variant for agent suggestions complete
- **Location**: `app/components/NotificationToast.tsx`
- **New variant**:
  - Icon: Sparkles ✨
  - Message: "3 new suggestions ready"
  - Action: "View" (opens notification bell)

#### New Component: CollectionInsight
- **Purpose**: Display AI-generated collection overview/insight
- **Props**:
  - `insight: string`
  - `generatedAt: Date`
  - `isStale: boolean` // true if >7 days old
- **Location**: `app/components/CollectionInsight.tsx`
- **Layout**:
  ```
  ┌─────────────────────────────────────────┐
  │ 🧠 Collection Insight                   │
  │ ────────────────────────────────────    │
  │ [AI-generated summary text about the    │
  │  themes, patterns, and content of this  │
  │  collection based on current items]     │
  │                                         │
  │ Generated 2 days ago                    │
  └─────────────────────────────────────────┘
  ```
- **States**:
  - **Fresh**: Normal styling, no indicator
  - **Stale**: Subtle "Updating..." indicator if agent is regenerating
  - **Empty**: "This collection doesn't have an AI insight yet. Add more items to generate one."

### Layouts

#### Notification Bell Dropdown
```
┌─────────────────────────────────┐
│ Suggestions (3)        [⚙️]     │ ← Header with settings icon
├─────────────────────────────────┤
│ [SuggestionCard 1]              │
│ [SuggestionCard 2]              │
│ [SuggestionCard 3]              │
│                                 │
│ [View All Suggestions →]        │
└─────────────────────────────────┘
```

#### Collection View with Insights and Suggestions
```
┌─────────────────────────────────────────┐
│ Collection: Frontend Dev                │
├─────────────────────────────────────────┤
│ [CollectionInsight]                     │ ← AI-generated overview
├─────────────────────────────────────────┤
│ [Items] [Suggestions (2)] [Settings]    │ ← Tab navigation
├─────────────────────────────────────────┤
│                                         │
│ (Items Tab)                             │
│ [Item 1]                                │
│ [Item 2]                                │
│                                         │
│ (Suggestions Tab)                       │
│ [SuggestionCard 1]                      │
│ [SuggestionCard 2]                      │
│                                         │
└─────────────────────────────────────────┘
```

**Collection Insight Placement**:
- Appears at top of collection view, above tab navigation
- Collapsible (user can minimize to save space)
- Persists across tab switches (always visible when expanded)
- Shows "Updating..." spinner when agent is regenerating

**Responsive Behavior**:
- **Mobile**:
  - Notification dropdown full-screen bottom sheet
  - Suggestion cards stack vertically
  - Actions at bottom of card
- **Tablet**:
  - Notification dropdown 400px wide
  - Collection tabs horizontal scroll
- **Desktop**:
  - Notification dropdown 500px wide, max-height with scroll
  - Collection tabs fixed horizontal

### Interaction Patterns

**Click on Notification Bell**:
1. Dropdown opens below bell (desktop) or bottom sheet (mobile)
2. Shows pending suggestions
3. Clicking outside closes dropdown

**Click "Approve" on Suggestion**:
1. Optimistic update: Remove from pending list immediately
2. Show success toast: "Item added to [Collection Name]"
3. API call to approve suggestion
4. If fails: Revert, show error toast

**Click "Reject" on Suggestion**:
1. Optimistic update: Remove from pending list
2. No toast (silent success)
3. API call to reject suggestion
4. If fails: Revert, show error toast

**Click "Edit" on Suggestion**:
1. Modal opens with item content in textarea
2. User edits content
3. Click "Save" → API call → Success toast → Modal closes
4. Click "Cancel" → Modal closes, no changes

**Click "Retry" on Failed Agent Run**:
1. Error indicator in bell changes to spinner
2. API call to retry agent
3. If succeeds: Suggestions appear normally
4. If fails again: Show error state again

**Hover over Collection Badge in Suggestion**:
1. Tooltip shows collection description
2. No action on click (informational only)

### States

#### Loading State: Agent Processing
- Notification bell shows spinner animation
- Dropdown shows: "Analyzing your content..."
- No suggestion cards visible yet

#### Error State: Agent Failed
- Notification bell shows red error dot
- Dropdown shows:
  ```
  ⚠️ Suggestions failed to generate
  [Retry Suggestions]
  ```
- Click "Retry" triggers manual retry

#### Empty State: No Suggestions
- Notification bell shows no badge
- Dropdown shows:
  ```
  ✅ All caught up!
  No pending suggestions at the moment.
  ```

#### Success State: Suggestions Available
- Notification bell shows count badge
- Dropdown shows list of suggestions
- Toast notification appears on new suggestions

#### Partial State: Some Suggestions Failed
- Show successful suggestions
- Banner at top: "Some suggestions couldn't be generated. [Retry]"

### Accessibility

**Screen Reader**:
- Notification bell: `aria-label="Suggestions inbox, 3 pending"`
- Processing state: `aria-live="polite"` announcement "Analyzing content"
- Suggestion card: Semantic HTML with proper heading hierarchy
- Action buttons: Clear labels "Approve suggestion", "Reject suggestion"

**Keyboard Navigation**:
- Tab through suggestion cards
- Enter to activate buttons
- Escape to close dropdown/modal
- Arrow keys to navigate between tabs

**Color Contrast**:
- All text meets WCAG AA standards (4.5:1 minimum)
- Error states use both color and icon (not color alone)
- Focus indicators visible and high contrast

**Focus Management**:
- Opening dropdown focuses first suggestion
- Approving suggestion returns focus to next suggestion
- Closing modal returns focus to trigger button

## Integration & Quality

### Testing Strategy

#### Unit Tests

**Agent Logic**:
- [ ] Agent with User A JWT cannot access User B inbox
- [ ] Agent with User A JWT cannot access User B collections
- [ ] Agent respects `is_private` flag on collections
- [ ] Agent generates max 5 suggestions per run
- [ ] Agent handles empty inbox gracefully
- [ ] Agent handles no collections gracefully

**API Endpoints**:
- [ ] POST /api/v1/agent/queue requires valid session
- [ ] POST /api/v1/agent/queue rejects if agent disabled
- [ ] GET /api/v1/suggestions only returns user's suggestions
- [ ] POST /api/v1/suggestions/:id/approve validates ownership
- [ ] POST /api/v1/suggestions/:id/reject validates ownership

**MCP Tools**:
- [ ] `get_user_inbox` filters by user_id from JWT
- [ ] `get_user_collections` excludes private collections
- [ ] `create_suggestion` validates all foreign keys

#### Integration Tests

**Full Flow**:
- [ ] User A extracts → Agent runs → Suggestions created for User A only
- [ ] User A and User B extract simultaneously → Suggestions don't cross
- [ ] Agent suggests item from Inbox → User approves → Item moved to collection
- [ ] Agent suggests item → User deletes collection → Suggestion cascade deleted
- [ ] Agent suggests item → User deletes item → Suggestion cascade deleted

**Error Handling**:
- [ ] Agent API timeout → Marked as failed → User can retry
- [ ] Agent API error → Logged → User can retry
- [ ] Approve suggestion fails → Reverts optimistic update → Shows error

#### Security Tests

**User Isolation**:
- [ ] **Critical**: Agent with manipulated JWT cannot access other user data
- [ ] **Critical**: Direct API calls with spoofed user_id rejected
- [ ] **Critical**: RLS policies prevent cross-user queries at database level
- [ ] Private collection data never included in agent context
- [ ] Agent logs sanitized (no user content)

**Penetration Testing**:
- [ ] Attempt to approve suggestion belonging to different user
- [ ] Attempt to inject malicious content via agent reasoning
- [ ] Attempt to bypass rate limiting with concurrent requests
- [ ] Attempt to trigger agent with invalid trigger_item_id

#### E2E Tests

**User Flows**:
- [ ] Extract URL → See agent processing → See suggestions → Approve → Verify item in collection
- [ ] Extract URL → See suggestions → Reject → Verify suggestion dismissed
- [ ] Extract URL → See suggestions → Edit → Verify edited content saved
- [ ] Agent fails → Click retry → Verify suggestions appear

### Monitoring

**Metrics**:
- **agent_runs_total** (counter): Total agent runs by status (queued/running/completed/failed)
  - **Why**: Track overall agent usage and failure rate
- **agent_run_duration_seconds** (histogram): Time from queue to completion
  - **Why**: Monitor performance SLA (target: 30 seconds)
- **suggestions_generated_total** (counter): Total suggestions by status (pending/approved/rejected)
  - **Why**: Measure agent output and acceptance rate
- **agent_api_cost_cents** (counter): Total API cost per user
  - **Why**: Track costs for budgeting and abuse prevention

**Logs**:
- **Agent Run Started**: `[AgentRun:uuid] Started for user:uuid, trigger:extraction`
- **Agent Run Completed**: `[AgentRun:uuid] Completed in 12.3s, generated 3 suggestions`
- **Agent Run Failed**: `[AgentRun:uuid] Failed: API timeout after 30s`
- **Suggestion Approved**: `[Suggestion:uuid] Approved by user:uuid, item:uuid → collection:uuid`
- **Suggestion Rejected**: `[Suggestion:uuid] Rejected by user:uuid`

**Alerts**:
- **Agent failure rate > 10%**: Alert #trove-alerts, investigate API issues
  - **Threshold**: 10 failures per 100 runs in 1 hour
  - **Action**: Check Claude API status, review logs for patterns
- **Agent duration > 60s (p95)**: Alert #trove-alerts, performance degradation
  - **Threshold**: 95th percentile exceeds 60 seconds
  - **Action**: Review API latency, optimize prompt size
- **Suggestion approval rate < 20%**: Alert #trove-team, agent quality issue
  - **Threshold**: Less than 20% approved over 1 week
  - **Action**: Review agent prompts, analyze rejected suggestions

### Documentation

- [ ] **README.md**:
  - Add "AI Suggestions" section explaining feature
  - Document agent trigger behavior
  - Explain user settings
- [ ] **ARCHITECTURE.md**:
  - Add agent system architecture diagram
  - Document MCP integration
  - Explain security model (JWT scoping, RLS policies)
- [ ] **API Documentation**:
  - Document all new endpoints
  - Include request/response examples
  - Document error codes
- [ ] **User Guide**:
  - Create "How to Use AI Suggestions" guide
  - Explain approve/reject/edit actions
  - Document aggressiveness settings

### Migration Path

**Existing Users**:
- Feature deployed with agent disabled by default (opt-in)
- Banner in UI: "Try AI Suggestions - let Trove organize your content automatically"
- Settings page prominently shows agent toggle
- After opt-in, agent runs on next extraction

**Existing Data**:
- No migration required (new tables only)
- Existing items work as-is
- Inbox collection must exist for agent to function

**Feature Flag**:
- Environment variable: `FEATURE_AGENT_ENABLED=true|false`
- Database flag: `users.is_beta_user` for selective rollout
- **Phase 1**: Enable for 5-10 beta users
- **Phase 2**: Enable for all users as opt-in
- **Phase 3**: Consider opt-out after proven value

**Backward Compatibility**:
- Agent is additive feature - no breaking changes
- Existing extraction flow unchanged (agent queued after)
- If agent disabled, extractions work exactly as before

## Out of Scope

Explicitly NOT included in Phase 1:

- **Web search for new content**: Agent only suggests from Inbox, doesn't search web for new items
- **Real-time streaming suggestions**: Agent runs async via Edge Function, no WebSocket streaming
- **Automatic approval**: All suggestions require manual user approval
- **Cross-collection similarity scoring**: No "Collection A is similar to Collection B" features
- **Agent-suggested tags or metadata**: Agent only suggests collections and generates insights, not tags
- **Bulk approve/reject**: Must review suggestions individually
- **Agent chat interface**: No conversational UI for agent
- **Email notifications for suggestions**: In-app only
- **Collection-level agent settings**: Global settings only, not per-collection
- **Manual insight refresh button**: Insights regenerate automatically based on staleness; no manual trigger (Phase 2)
- **Insight editing**: Users cannot edit AI-generated insights (Phase 2 feature)
- **Insight history**: No version control or history of previous insights (Phase 2 feature)

These may be considered for future phases based on user feedback.

## Open Questions

- [ ] **Cost modeling**: What is acceptable cost per user per month for agent API calls? Need to monitor actual usage (both suggestions + insight regeneration).
- [ ] **Collection insight staleness threshold**: Is 7 days + 5 new items the right threshold for triggering regeneration? May need tuning based on usage patterns.
- [ ] **Collection insight length**: What's the ideal length for ai_insight text? Too short lacks value, too long clutters UI. Start with 200-300 words?
- [ ] **Inbox collection creation**: Should Inbox be created automatically on user signup, or on first extraction? How do we handle existing users without Inbox?
- [ ] **Multiple target collections**: If agent suggests item for Collections A, B, and C, should it create 3 separate suggestions or one suggestion with multiple targets?
- [ ] **Confidence threshold**: What minimum confidence score (if any) should filter out low-quality suggestions?
- [ ] **Rate limiting granularity**: Should rate limits be per-user, per-IP, or both?
- [ ] **Edge Function retries**: If Edge Function fails, should database webhook retry automatically? Or rely on manual retry button?
- [ ] **Insight regeneration UI feedback**: Should users be notified when collection insights are updated, or is it transparent background maintenance?

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cross-user data leakage via agent | Low | Critical | Comprehensive security testing (unit, integration, penetration). Code review focused on JWT validation and RLS in Edge Function. |
| Agent costs exceed budget | Medium | High | Max 5 suggestions per run. Monitor costs per user (suggestions + insights). Add user-level budgets if needed. |
| Agent suggestions are low quality | Medium | Medium | Start with balanced aggressiveness. Allow user to adjust. Track approval rate metric. |
| Agent latency exceeds 30s SLA | Low | Medium | Edge Functions have no timeout. Optimize prompt size. Cache collection insights. |
| Edge Function webhook fails to trigger | Low | High | Monitor webhook delivery. Add manual retry button. Consider pg_notify as fallback trigger mechanism. |
| Database webhook creates infinite loop | Low | Critical | Ensure Edge Function never writes to agent_runs in a way that re-triggers webhook. Use status checks. |
| Collection insights become stale | Medium | Low | Automatic regeneration based on staleness threshold. Users can manually request refresh (future). |
| Users don't discover feature | High | Low | Toast notification after first extraction. Settings page banner. Onboarding flow. |
| Inbox collection concept confusing | Medium | Medium | Clear UI labeling. User guide documentation. Consider renaming to "Unsorted". |
| Race conditions on suggestion approval | Medium | Low | Idempotency checks before moving items. Unique constraint prevents duplicate suggestions. |
| Agent fails silently, users don't notice | Low | Low | Error state in notification bell. Retry button. Log all failures. |
| Prompt injection via user content | Low | High | Sanitize user content before passing to agent. Use system/user message separation. |

## Implementation Checklist

### Database & Migrations
- [ ] Create `suggestions` table with RLS policies and UNIQUE constraint (item_id, target_collection_id)
- [ ] Create `agent_runs` table with RLS policies
- [ ] Add columns to `collections` table: is_private, is_inbox, ai_insight, ai_insight_generated_at, items_count_at_insight
- [ ] Create unique index on collections(user_id) WHERE is_inbox=true (one Inbox per user)
- [ ] Add `agent_enabled` and `agent_aggressiveness` columns to `users` table
- [ ] Create database webhook on `agent_runs` INSERT to trigger Edge Function
- [ ] Test migrations on staging database
- [ ] Verify RLS policies prevent cross-user access
- [ ] Verify unique constraints work as expected

### Supabase Edge Function
- [ ] Create Edge Function: `supabase/functions/process-agent-run/index.ts`
- [ ] Set up Deno runtime with required dependencies (Claude SDK, MCP)
- [ ] Implement webhook payload parsing (agent_run_id, user_id)
- [ ] Generate user-scoped JWT for MCP access
- [ ] Implement error handling (catch all, update status to 'failed')
- [ ] Add timeout safety (though no hard limit needed)
- [ ] Deploy Edge Function to Supabase
- [ ] Test Edge Function locally with `supabase functions serve`

### MCP Server (within Edge Function)
- [ ] Implement MCP server in Edge Function context
- [ ] Create `get_user_inbox` tool with JWT validation (is_inbox=true)
- [ ] Create `get_user_collections` tool (excluding private and inbox)
- [ ] Create `get_collection_recent_items` tool (fallback when no ai_insight)
- [ ] Create `create_suggestion` tool (with ON CONFLICT DO NOTHING)
- [ ] Create `update_collection_insight` tool
- [ ] Add integration tests for all MCP tools
- [ ] Security review of JWT validation logic

### Agent Logic (in Edge Function)
- [ ] Set up Claude Agent SDK in Edge Function
- [ ] Implement agent prompt template for suggestion generation
- [ ] Implement agent prompt template for insight generation
- [ ] Implement collection staleness detection logic (7 days + item growth)
- [ ] Implement suggestion generation logic (max 5)
- [ ] Implement collection insight regeneration logic
- [ ] Add error handling and retry logic
- [ ] Add cost tracking (tokens, API cost)
- [ ] Test agent with real user data

### API Endpoints
- [ ] Implement POST /api/v1/agent/queue (insert agent_run, trigger webhook)
- [ ] Implement GET /api/v1/suggestions (with validation filtering)
- [ ] Implement POST /api/v1/suggestions/:id/approve (with idempotency checks)
- [ ] Implement POST /api/v1/suggestions/:id/reject
- [ ] Implement POST /api/v1/agent/retry/:agent_run_id
- [ ] Implement GET /api/v1/users/me/settings
- [ ] Implement PATCH /api/v1/users/me/settings
- [ ] Modify POST /api/v1/extract to queue agent task after extraction
- [ ] Add Zod validation for all endpoints
- [ ] Add rate limiting middleware
- [ ] Test that idempotency works (approve already-moved item returns success)

### UI Components
- [ ] Create `NotificationBell` component (with validation filtering)
- [ ] Create `SuggestionInbox` component
- [ ] Create `SuggestionCard` component
- [ ] Create `SuggestionEditModal` component
- [ ] Create `CollectionInsight` component (displays ai_insight with generated date)
- [ ] Add CollectionInsight to collection view (collapsible, above tabs)
- [ ] Create `AgentSettings` component in settings page
- [ ] Create `CollectionSuggestionsTab` component
- [ ] Add toast notification variant for suggestions
- [ ] Implement loading/error/empty states
- [ ] Implement "Updating insight..." state for collections
- [ ] Test responsive layouts (mobile/tablet/desktop)
- [ ] Add accessibility features (ARIA labels, keyboard nav)

### State Management
- [ ] Add suggestion state to global store
- [ ] Implement polling for new suggestions
- [ ] Implement optimistic updates for approve/reject
- [ ] Add agent processing state

### Testing
- [ ] **CRITICAL**: Unit test - User A agent cannot access User B data (Edge Function)
- [ ] **CRITICAL**: Integration test - Simultaneous extractions don't cross suggestions
- [ ] **CRITICAL**: Security test - JWT manipulation rejected
- [ ] **CRITICAL**: Penetration test - Attempt cross-user data access
- [ ] Test Edge Function webhook trigger flow
- [ ] Test agent with empty inbox
- [ ] Test agent with no collections
- [ ] Test cascade deletion (item/collection deleted)
- [ ] Test retry flow
- [ ] Test unique constraint on suggestions (prevent duplicates)
- [ ] Test idempotency: approve suggestion for item already in collection
- [ ] Test validation filtering: don't show invalid suggestions in UI
- [ ] Test collection insight regeneration (stale detection)
- [ ] Test collection insight fallback (fetch recent items when null)
- [ ] E2E test: Extract → Suggest → Approve → Verify
- [ ] E2E test: Extract → Insight regenerated → Verify in UI
- [ ] E2E test: Race condition → Manual move → Approve suggestion → No error
- [ ] Code review: Security-focused review of auth/RLS in Edge Function

### Monitoring & Logging
- [ ] Add metrics: agent_runs_total, agent_run_duration_seconds
- [ ] Add metrics: suggestions_generated_total, agent_api_cost_cents
- [ ] Add logging for all agent lifecycle events
- [ ] Configure alerts for failure rate and latency
- [ ] Set up dashboard for agent metrics

### Documentation
- [ ] Update README.md with AI Suggestions section
- [ ] Update ARCHITECTURE.md with agent system diagram
- [ ] Document all API endpoints
- [ ] Create user guide for AI Suggestions
- [ ] Document security model and RLS policies

### Deployment
- [ ] Set feature flag `FEATURE_AGENT_ENABLED=false` (disabled by default)
- [ ] Deploy to staging
- [ ] Enable for 3-5 beta users via `users.is_beta_user` flag
- [ ] Monitor metrics for 1 week
- [ ] Gather beta user feedback
- [ ] Fix critical bugs
- [ ] Enable for all users as opt-in
- [ ] Monitor adoption rate and success metrics

### Success Criteria Validation
- [ ] Agent suggests items from Inbox to collections (tested with real data)
- [ ] Collection insights regenerate when stale (tested with aging collections)
- [ ] Suggestions appear in UI within 30 seconds of extraction
- [ ] User can approve/reject/edit suggestions
- [ ] Idempotency works: approving already-moved item succeeds gracefully
- [ ] Unique constraint prevents duplicate suggestions
- [ ] Edge Function triggers correctly via database webhook
- [ ] Security tests pass (no cross-user data leakage in Edge Function)
- [ ] Collection insights display correctly in UI
- [ ] Acceptance rate > 30% (after 2 weeks of beta)

## Timeline & Milestones

### Phase 1: Foundation (Week 1)
- [ ] Database migrations and schema
- [ ] MCP server implementation
- [ ] Agent SDK setup and basic logic
- [ ] Security testing framework

### Phase 2: Core Feature (Week 2)
- [ ] API endpoints (queue, suggestions, approve/reject)
- [ ] UI components (NotificationBell, SuggestionCard)
- [ ] State management and polling
- [ ] Integration testing

### Phase 3: Polish & Launch (Week 3)
- [ ] Settings UI and user preferences
- [ ] Error handling and retry flow
- [ ] Documentation
- [ ] Beta rollout to 5 users
- [ ] Monitor and iterate based on feedback

## References

- [Claude Agent SDK Documentation](https://github.com/anthropics/agent-sdk)
- [Model Context Protocol (MCP) Specification](https://modelcontextprotocol.io/)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Deno Runtime Documentation](https://deno.land/manual)
- Existing collection overview feature: `supabase/migrations/007_ai_collection_overviews.sql`
- Existing context endpoint: `app/api/v1/collections/[id]/context/route.ts`
