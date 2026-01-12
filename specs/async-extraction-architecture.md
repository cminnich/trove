# Feature: Asynchronous URL Extraction Architecture

**Created**: 2026-01-12
**Status**: Phase 1 In Progress
**Complexity**: High

## Overview
Refactor the URL extraction architecture from synchronous Next.js API route to asynchronous Supabase Edge Function workflow. This makes the system robust against browser closures, timeouts, and provides a better user experience with real-time updates instead of polling.

## Success Criteria
- [ ] Items are saved to database immediately when user submits URL (pending state)
- [ ] Extraction happens asynchronously via Supabase Edge Function
- [ ] Database trigger automatically invokes Edge Function on item insert
- [ ] Frontend uses Realtime subscriptions instead of polling
- [ ] Extraction failures can be manually retried by user
- [ ] Collection assignments work correctly with async flow
- [ ] No data loss if user closes browser during extraction
- [ ] 90-second timeout for extraction process

## User Journey

### Current (Synchronous) Flow
1. User submits URL on `/add` page
2. Frontend waits 10-30 seconds while extraction completes
3. If browser closes, extraction is lost
4. User sees spinning loader with no visibility into progress
5. Timeout errors after 30 seconds cause failure

### New (Asynchronous) Flow
1. User submits URL and optionally selects collections on `/add` page
2. Frontend immediately receives `item_id` and 202 Accepted status
3. Item appears in UI with "Extracting..." placeholder and selected collections
4. User can close browser - extraction continues server-side
5. When user returns or keeps page open, Realtime subscription updates item with extracted data
6. User sees live title/content update when extraction completes
7. On failure, user sees error state with "Retry" button

## Technical Implementation

### Phase 1: Safety Layer (Immediate Response)

#### Architecture Decisions
- **Immediate Insert**: Create database row BEFORE extraction starts
- **202 Accepted**: Return HTTP 202 with `item_id` to signal async processing
- **Status Tracking**: Use explicit `extraction_status` enum column for clear state management

#### Data Model Changes

**New Migration**: `008_add_extraction_status.sql`

```sql
-- Add extraction_status enum type
CREATE TYPE extraction_status AS ENUM ('pending', 'processing', 'complete', 'failed');

-- Add extraction_status column to items table
ALTER TABLE items
  ADD COLUMN extraction_status extraction_status DEFAULT 'pending',
  ADD COLUMN extraction_error text,
  ADD COLUMN extraction_started_at timestamp,
  ADD COLUMN extraction_completed_at timestamp;

-- Index for querying pending/failed items
CREATE INDEX items_extraction_status_idx ON items(extraction_status);

-- Update existing items to 'complete' status
UPDATE items SET extraction_status = 'complete' WHERE title IS NOT NULL;

-- Make title nullable (since pending items won't have title yet)
ALTER TABLE items ALTER COLUMN title DROP NOT NULL;
```

#### API Changes

**File**: `app/api/items/route.ts`

**Current Flow**:
1. Check for existing item
2. Call `/api/extract` (blocks 10-30s)
3. Save extracted data
4. Return complete item

**New Flow**:
1. Validate URL
2. Check for existing item (if exists and complete, return immediately)
3. Insert new item with status='pending', title='Extracting...', type='article'
4. Assign to collections immediately if provided
5. Return 202 Accepted with item_id
6. (Phase 1 stops here - extraction logic stays in API route for now, just doesn't block response)

**Response Format**:
```typescript
// Success: 202 Accepted
{
  success: true,
  status: 'pending',
  data: {
    item: {
      id: 'uuid',
      source_url: 'https://...',
      title: 'Extracting...',
      extraction_status: 'pending',
      // ... other fields
    },
    collections: ['collection-id-1', 'collection-id-2']
  }
}

// Already exists and complete: 200 OK
{
  success: true,
  status: 'complete',
  data: {
    item: { /* complete item data */ },
    collections: []
  }
}

// Error: 400/500
{
  success: false,
  error: 'Error message'
}
```

#### Collection Assignment in Async Flow
- Collections are passed in initial POST request: `{ url, collections: [{id, notes}] }`
- Collections are assigned to the item immediately, even in 'pending' state
- User sees the item appear in selected collections with "Extracting..." placeholder
- When extraction completes, item updates in-place via Realtime

### Phase 2: Edge Function & Database Trigger

#### Edge Function

**Location**: `supabase/functions/extract-item/index.ts`

**Responsibilities**:
1. Receive `item_id` as input
2. Fetch item from database
3. Update status to 'processing' with timestamp
4. Perform extraction (Jina + Claude) with 90-second timeout
5. On success: Update item with extracted data, set status='complete'
6. On failure: Set status='failed' with error message

**Error Handling**:
- No automatic retries (user manually retries via UI)
- All errors logged to Supabase Edge Function logs
- Error message stored in `extraction_error` column
- Timeout after 90 seconds

**Code Structure**:
```typescript
// supabase/functions/extract-item/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { item_id } = await req.json()

  // 1. Update status to 'processing'
  // 2. Fetch from Jina (with timeout)
  // 3. Extract with Claude (with timeout)
  // 4. Update item with results
  // 5. Set status to 'complete' or 'failed'

  return new Response(JSON.stringify({ success: true }))
})
```

#### Database Trigger

**Migration**: `009_add_extraction_trigger.sql`

```sql
-- Create function to invoke Edge Function via pg_net
CREATE OR REPLACE FUNCTION trigger_extraction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for new items with 'pending' status
  IF NEW.extraction_status = 'pending' THEN
    -- Invoke Edge Function asynchronously via pg_net
    PERFORM net.http_post(
      url := 'https://[project-ref].supabase.co/functions/v1/extract-item',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.anon_key')
      ),
      body := jsonb_build_object('item_id', NEW.id::text)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires AFTER INSERT
CREATE TRIGGER on_item_insert_trigger_extraction
  AFTER INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_extraction();
```

**Constraints**:
- Trigger runs asynchronously (doesn't block INSERT)
- Uses `pg_net` extension for HTTP requests
- Requires Supabase project configuration for Edge Function URL

### Phase 3: Frontend Realtime Subscription

#### Changes to `useCaptureState.ts`

**Remove**:
- Polling logic
- `setInterval` for checking extraction status

**Add**:
- Supabase Realtime channel subscription
- Filter for UPDATE events on specific item_id
- Auto-update UI state when extraction completes

**Code Pattern**:
```typescript
// Subscribe to item updates
const channel = supabase
  .channel(`item-${itemId}`)
  .on('postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'items',
      filter: `id=eq.${itemId}`
    },
    (payload) => {
      const updatedItem = payload.new
      if (updatedItem.extraction_status === 'complete') {
        // Update UI with extracted data
        setState(prev => ({
          ...prev,
          extraction: {
            status: 'complete',
            item: updatedItem
          }
        }))
      } else if (updatedItem.extraction_status === 'failed') {
        // Show error state
        setState(prev => ({
          ...prev,
          extraction: {
            status: 'failed',
            error: updatedItem.extraction_error
          }
        }))
      }
    }
  )
  .subscribe()

// Cleanup
return () => {
  supabase.removeChannel(channel)
}
```

## UI/UX Design

### Components
- `app/add/page.tsx` - Main capture page (no changes needed)
- `app/add/hooks/useCaptureState.ts` - State management (Phase 3 changes)
- `app/add/components/ExtractionStatusCard.tsx` - Shows extraction status

### States

**Pending State**:
- Item appears immediately with "Extracting..." title
- Loading spinner or progress indicator
- Collections already assigned and visible
- User can add notes while extraction runs

**Processing State**:
- Same as pending (distinction is server-side only)

**Complete State**:
- Title and content smoothly update in place
- Loading indicator disappears
- Success message: "Extraction complete!"

**Failed State**:
- Error message displayed
- "Retry" button triggers new extraction
- Original URL preserved for retry

## Integration & Quality

### Testing Strategy

**Phase 1 Testing**:
1. Submit URL, verify 202 response with item_id
2. Check database has pending item with correct status
3. Verify collections assigned immediately
4. Test with invalid URL (should fail fast)
5. Test with duplicate URL (should return existing item)

**Phase 2 Testing**:
1. Insert pending item manually, verify trigger fires
2. Check Edge Function logs for invocation
3. Test Edge Function directly with item_id
4. Verify timeout behavior (90s)
5. Test failure scenarios (invalid URL, Jina down, Claude API error)

**Phase 3 Testing**:
1. Subscribe to Realtime, verify UPDATE events received
2. Test with browser closed and reopened
3. Test with multiple tabs open (both should update)
4. Verify cleanup on unmount

### Monitoring

**Metrics**:
- Extraction success rate (complete vs failed)
- Average extraction time (started_at to completed_at)
- Items stuck in 'processing' state > 5 minutes
- Edge Function invocation count
- Edge Function error rate

**Logs**:
- Edge Function execution logs (Supabase dashboard)
- API route logs (Next.js)
- Database trigger logs (pg_net)

### Documentation

**Files to Update**:
- `README.md` - Update architecture section with async flow diagram
- `ARCHITECTURE.md` - Document Edge Function, trigger, Realtime setup
- API documentation - Update `/api/items` endpoint spec with 202 response
- Developer guide - Add section on testing Edge Functions locally

### Migration Path

**Phase 1: Immediate Safety (This Implementation)**:
- Non-breaking change
- Existing flows continue to work
- New items get pending status but still extract synchronously
- Frontend receives item immediately but extraction completes in background

**Phase 2: Move to Edge Function**:
- Create and deploy Edge Function
- Add database trigger
- Test in staging with pending items
- Gradually migrate existing extraction logic
- Keep API route as fallback

**Phase 3: Frontend Realtime**:
- Add Realtime subscription alongside existing polling
- Test with both approaches active
- Remove polling once Realtime proven stable
- Update UI for better async experience

## Out of Scope

- Batch extraction of multiple URLs
- Scheduled re-extraction for stale items
- Extraction queue with priority system
- Webhook notifications when extraction completes
- Extraction analytics dashboard
- Advanced retry strategies (exponential backoff, circuit breaker)

## Open Questions

- [x] How should collection assignment work? **Answer**: Assign immediately on insert
- [x] Should we auto-retry failed extractions? **Answer**: No, manual retry only
- [x] What timeout for Edge Function? **Answer**: 90 seconds
- [x] How to track extraction state? **Answer**: enum column with pending/processing/complete/failed
- [ ] Should we add a job queue for rate limiting? (Deferred to future iteration)
- [ ] How to handle Supabase Edge Function cold starts? (Monitor in production)

## Risks & Mitigations

### Risk 1: Database Trigger Fails Silently
**Impact**: Items stuck in 'pending' state forever
**Mitigation**:
- Add monitoring for items in 'pending' state > 5 minutes
- Build admin tool to manually trigger extraction for stuck items
- Add health check endpoint that tests trigger -> Edge Function flow

### Risk 2: Edge Function Timeout/Crash
**Impact**: Items stuck in 'processing' state
**Mitigation**:
- Set extraction_started_at timestamp before starting
- Build cleanup job to mark items as 'failed' if processing > 10 minutes
- Edge Function returns error response instead of crashing

### Risk 3: Realtime Subscription Drops
**Impact**: Frontend doesn't receive completion event
**Mitigation**:
- Add heartbeat/keepalive for Realtime connection
- Fallback: Poll item status if no update received within 2 minutes
- Show connection status indicator in UI

### Risk 4: Race Condition on Duplicate URL
**Impact**: Two pending items created for same URL
**Mitigation**:
- Check for ANY item with URL (not just complete ones) before insert
- Add unique constraint on (source_url, extraction_status) if needed
- Handle duplicate key errors gracefully

## Implementation Phases Detail

### Phase 1: Safety Layer (Current Sprint)
**Goal**: Return item_id immediately without breaking existing functionality

**Tasks**:
1. Create migration for extraction_status enum and columns
2. Run migration on database
3. Update `/api/items/route.ts`:
   - Insert pending item immediately
   - Assign collections right away
   - Return 202 with item_id
   - Keep extraction logic but move it after response
4. Update TypeScript types for new columns
5. Test with real URL extraction
6. Verify collections assignment works

**Success Criteria**:
- API returns in < 100ms instead of 10-30s
- Item appears in database with 'pending' status
- Collections assigned immediately
- Extraction still completes (moved to background task for now)

### Phase 2: Edge Function & Trigger (Next Sprint)
**Goal**: Move extraction to serverless Edge Function with database trigger

**Tasks**:
1. Initialize Supabase Edge Function: `supabase functions new extract-item`
2. Move extraction logic (Jina + Claude) to Edge Function
3. Add 90-second timeout handling
4. Deploy Edge Function: `supabase functions deploy extract-item`
5. Create trigger migration with pg_net
6. Enable pg_net extension on Supabase project
7. Test trigger fires correctly on INSERT
8. Remove extraction from API route (trigger handles it now)
9. Add error handling and logging
10. Monitor Edge Function invocations

**Success Criteria**:
- Edge Function invoked automatically when item inserted
- Extraction completes within 90 seconds or fails gracefully
- Item status updates to 'complete' or 'failed'
- No items stuck in 'pending' state

### Phase 3: Frontend Realtime (Final Sprint)
**Goal**: Replace polling with Realtime subscriptions for live updates

**Tasks**:
1. Install/verify `@supabase/supabase-js` v2
2. Add Realtime channel subscription in `useCaptureState.ts`
3. Filter for UPDATE events on specific item_id
4. Update state when extraction_status changes
5. Add connection status indicator
6. Handle reconnection on network drop
7. Remove old polling code
8. Add cleanup on component unmount
9. Test with browser close/reopen
10. Test with slow network

**Success Criteria**:
- UI updates in real-time when extraction completes
- No polling or intervals running
- Reconnection works after network drop
- Multiple tabs all receive updates
- Clean subscription cleanup on unmount

## Notes

- This refactor fundamentally changes how extraction works but maintains backward compatibility
- Each phase is independently deployable and testable
- User experience improves progressively through each phase
- Database trigger + Edge Function pattern is Supabase best practice for async jobs
- Realtime subscriptions are more efficient than polling and provide better UX
