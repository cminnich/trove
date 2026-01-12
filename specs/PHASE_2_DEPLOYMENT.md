# Phase 2 Deployment: Edge Function + Database Trigger

**Status**: Code Complete - Ready for Deployment
**Completed**: 2026-01-12

## What Was Implemented

Phase 2 moves extraction to a dedicated Supabase Edge Function that's automatically invoked by a database trigger. This eliminates the reliability issues with background extraction in the API route.

### Changes Made

#### 1. Supabase Edge Function (`supabase/functions/extract-item/index.ts`)
- ✅ Created dedicated Deno-based Edge Function for extraction
- ✅ 90-second timeout handling with AbortController
- ✅ Proper error handling with detailed error messages
- ✅ Automatic status updates (processing → complete/failed)
- ✅ Snapshot creation for price tracking
- ✅ Comprehensive logging for debugging

#### 2. Database Trigger (`supabase/migrations/009_add_extraction_trigger.sql`)
- ✅ Created `trigger_extraction()` function
- ✅ Uses `pg_net` extension for async HTTP requests
- ✅ Fires AFTER INSERT when extraction_status = 'pending'
- ✅ Invokes Edge Function with item_id payload
- ✅ Non-blocking trigger (doesn't slow down INSERT)

#### 3. API Route Cleanup (`app/api/items/route.ts`)
- ✅ Removed `performBackgroundExtraction()` function (160+ lines)
- ✅ Simplified to just INSERT and return 202 Accepted
- ✅ Database trigger now handles extraction automatically

#### 4. TypeScript Configuration
- ✅ Added `supabase/functions` to tsconfig exclude
- ✅ Created `deno.json` for Edge Function config
- ✅ No TypeScript errors in build

## Deployment Steps

### Prerequisites

Before deploying, ensure you have:
- Supabase CLI installed: `brew install supabase/tap/supabase`
- Supabase project created and linked
- Anthropic API key for Claude

### Step 1: Run Database Migrations

Apply migrations 008 (if not already done) and 009:

**Via Supabase Dashboard (Recommended):**
1. Go to Supabase Dashboard → SQL Editor
2. Run `supabase/migrations/008_add_extraction_status.sql` (if not already applied)
3. Run `supabase/migrations/009_add_extraction_trigger.sql`
4. Verify:
   - `extraction_status` enum exists
   - `trigger_extraction()` function exists
   - Trigger `on_item_insert_trigger_extraction` exists

**Via Supabase CLI:**
```bash
# Link your project (first time only)
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

### Step 2: Configure Database Settings for Trigger

The trigger needs your project URL to invoke the Edge Function. Configure via SQL:

```sql
-- Set Supabase project URL (replace with your actual URL)
ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';

-- Set service role key (replace with your actual key from Supabase Dashboard → Settings → API)
ALTER DATABASE postgres SET app.supabase_service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

Run this in Supabase Dashboard → SQL Editor after running the migration.

### Step 3: Deploy Edge Function

Deploy the extract-item Edge Function:

```bash
# Deploy the function
supabase functions deploy extract-item

# Set ANTHROPIC_API_KEY secret (required for Claude API)
supabase secrets set ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

The function will automatically have access to:
- `SUPABASE_URL` - Auto-provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided by Supabase
- `ANTHROPIC_API_KEY` - You provide this via secrets

### Step 4: Deploy Next.js Code

Commit and push the code changes:

```bash
git add .
git commit -m "Phase 2: Move extraction to Edge Function with database trigger"
git push origin main
```

Vercel will automatically deploy the updated API route (with background extraction removed).

### Step 5: Test the Flow

After deployment, test with a real URL:

**1. Submit a URL via `/add` page:**
```
1. Go to https://your-app.vercel.app/add
2. Enter a URL (e.g., a product page)
3. Select a collection (optional)
4. Submit
```

**Expected behavior:**
- Response comes back in <100ms with 202 Accepted
- Item appears in UI with status "Extracting..."
- Database trigger fires automatically
- Edge Function is invoked within seconds
- Item updates to "complete" or "failed" status within 10-30 seconds

**2. Check Edge Function Logs:**
```bash
# View real-time logs
supabase functions logs extract-item --follow

# Or in Supabase Dashboard → Edge Functions → extract-item → Logs
```

Look for:
- `[item_id] Starting extraction`
- `[item_id] Fetching content from Jina AI`
- `[item_id] Content fetched, calling Claude`
- `[item_id] Extraction complete, updating database`
- `[item_id] ✓ Extraction successful`

**3. Check Database:**
```sql
-- View recent extractions
SELECT
  id,
  title,
  extraction_status,
  extraction_error,
  extraction_started_at,
  extraction_completed_at
FROM items
ORDER BY created_at DESC
LIMIT 10;

-- Check for stuck items
SELECT COUNT(*) FROM items
WHERE extraction_status IN ('pending', 'processing')
AND created_at < NOW() - INTERVAL '5 minutes';
```

## Troubleshooting

### Issue: Trigger Not Firing

**Symptoms**: Items stay in 'pending' status forever

**Diagnosis**:
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_item_insert_trigger_extraction';

-- Check if pg_net is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Check database settings
SHOW app.supabase_url;
SHOW app.supabase_service_role_key;
```

**Fix**:
1. Verify migration 009 ran successfully
2. Check database settings are configured (Step 2)
3. Ensure pg_net extension is enabled

### Issue: Edge Function Not Invoked

**Symptoms**: Trigger fires but Edge Function never runs

**Diagnosis**:
```bash
# Check Edge Function exists
supabase functions list

# Check Edge Function logs for errors
supabase functions logs extract-item
```

**Fix**:
1. Verify Edge Function is deployed: `supabase functions deploy extract-item`
2. Check database settings have correct project URL
3. Verify service role key is correct

### Issue: Edge Function Fails

**Symptoms**: Items marked as 'failed', error in extraction_error

**Diagnosis**:
```bash
# View detailed logs
supabase functions logs extract-item --follow

# Check specific item error
SELECT extraction_error FROM items WHERE id = 'item_id';
```

**Common errors and fixes**:
- **"Jina AI fetch failed"**: URL might be inaccessible, check if site blocks scrapers
- **"Claude API error"**: Check ANTHROPIC_API_KEY is set correctly
- **"Extraction timed out"**: Increase timeout or check if site is very slow
- **"Failed to save extraction results"**: Check database permissions

### Issue: Timeout Errors

**Symptoms**: Items fail with "Extraction timed out after 90 seconds"

**Fix**:
1. Check if URL is responding slowly: `curl -w "@%{time_total}" https://the-url.com`
2. If site is legitimately slow, increase timeout in Edge Function (line 7)
3. Consider adding retry logic for timeouts

### Issue: Items Stuck in 'processing'

**Symptoms**: Items have `extraction_started_at` but never complete

**Diagnosis**:
```sql
-- Find stuck items
SELECT
  id,
  title,
  extraction_started_at,
  NOW() - extraction_started_at as stuck_duration
FROM items
WHERE extraction_status = 'processing'
AND extraction_started_at < NOW() - INTERVAL '10 minutes';
```

**Fix**:
1. Check Edge Function logs for crashes
2. Manually mark as failed:
```sql
UPDATE items
SET
  extraction_status = 'failed',
  extraction_error = 'Edge Function crashed or timed out',
  extraction_completed_at = NOW()
WHERE extraction_status = 'processing'
AND extraction_started_at < NOW() - INTERVAL '10 minutes';
```

## Monitoring

### Key Metrics to Watch

1. **Extraction Success Rate**:
```sql
SELECT
  extraction_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM items
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY extraction_status;
```

2. **Average Extraction Time**:
```sql
SELECT
  AVG(EXTRACT(EPOCH FROM (extraction_completed_at - extraction_started_at))) as avg_seconds,
  MIN(EXTRACT(EPOCH FROM (extraction_completed_at - extraction_started_at))) as min_seconds,
  MAX(EXTRACT(EPOCH FROM (extraction_completed_at - extraction_started_at))) as max_seconds
FROM items
WHERE extraction_status = 'complete'
AND created_at > NOW() - INTERVAL '24 hours';
```

3. **Failure Reasons**:
```sql
SELECT
  extraction_error,
  COUNT(*) as count
FROM items
WHERE extraction_status = 'failed'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY extraction_error
ORDER BY count DESC;
```

### Edge Function Monitoring

View logs in real-time:
```bash
supabase functions logs extract-item --follow
```

Or in Supabase Dashboard → Edge Functions → extract-item → Logs

Look for:
- High error rates
- Timeout patterns
- Slow response times from Jina/Claude

## Rollback Plan

If Phase 2 causes issues, you can roll back:

### Option 1: Disable Trigger Only (Keep Edge Function)

```sql
-- Disable the trigger
DROP TRIGGER IF EXISTS on_item_insert_trigger_extraction ON items;
```

This stops automatic extraction but keeps the Edge Function available for manual invocation.

### Option 2: Full Rollback

```sql
-- Drop trigger and function
DROP TRIGGER IF EXISTS on_item_insert_trigger_extraction ON items;
DROP FUNCTION IF EXISTS trigger_extraction();

-- Disable pg_net (optional)
DROP EXTENSION IF EXISTS pg_net CASCADE;
```

Then revert the API route code to Phase 1 version (with `performBackgroundExtraction`).

## Success Criteria Checklist

Before moving to Phase 3, verify:

- [ ] Migration 009 applied successfully
- [ ] Database settings configured (project URL and service role key)
- [ ] Edge Function deployed and accessible
- [ ] ANTHROPIC_API_KEY secret set
- [ ] Test extraction completes successfully (submit URL, see it complete)
- [ ] Edge Function logs show successful extraction
- [ ] No items stuck in 'pending' or 'processing' for >5 minutes
- [ ] Extraction success rate >90% (check failed extractions)
- [ ] Average extraction time <30 seconds
- [ ] Next.js API route returns in <100ms (not blocked)

## Next Steps: Phase 3

Once Phase 2 is deployed and verified, Phase 3 will:

1. Add Supabase Realtime subscriptions to frontend
2. Remove polling (if any exists)
3. Show live updates when extraction completes
4. Add connection status indicators
5. Handle reconnection gracefully

See `specs/async-extraction-architecture.md` for full Phase 3 plan.

## Files Changed

- `supabase/functions/extract-item/index.ts` (new) - Edge Function
- `supabase/functions/extract-item/README.md` (new) - Edge Function docs
- `supabase/functions/deno.json` (new) - Deno configuration
- `supabase/migrations/009_add_extraction_trigger.sql` (new) - Trigger migration
- `app/api/items/route.ts` (modified) - Removed background extraction
- `tsconfig.json` (modified) - Exclude Edge Functions
- `specs/PHASE_2_DEPLOYMENT.md` (this file)

## Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [pg_net Extension Docs](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Database Triggers Guide](https://supabase.com/docs/guides/database/postgres/triggers)
- [Anthropic API Docs](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
