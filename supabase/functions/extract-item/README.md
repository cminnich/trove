# Extract Item Edge Function

This Supabase Edge Function handles asynchronous URL extraction for items. It's automatically invoked by a database trigger when a new item is inserted with `extraction_status = 'pending'`.

## Functionality

1. Receives `item_id` from database trigger
2. Fetches item from database
3. Updates status to 'processing'
4. Fetches content from Jina AI Reader
5. Extracts structured data using Claude (Anthropic API)
6. Updates item with extracted data
7. Creates snapshot for price tracking
8. Handles errors and timeouts (90 seconds)

## Environment Variables Required

Configure these in Supabase Dashboard → Edge Functions → Configuration:

- `SUPABASE_URL` - Your Supabase project URL (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (auto-provided)
- `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude

## Deployment

```bash
# Deploy the function
supabase functions deploy extract-item

# Set the ANTHROPIC_API_KEY secret
supabase secrets set ANTHROPIC_API_KEY=your_key_here
```

## Testing

You can test the Edge Function directly:

```bash
# Test with curl
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/extract-item' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"item_id":"SOME_ITEM_ID"}'
```

Or test locally:

```bash
# Start local Edge Functions
supabase functions serve extract-item

# In another terminal, invoke it
curl -i --location --request POST 'http://localhost:54321/functions/v1/extract-item' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"item_id":"test-item-id"}'
```

## Logs

View logs in Supabase Dashboard → Edge Functions → Logs, or via CLI:

```bash
supabase functions logs extract-item
```

## Timeout Handling

The function has a 90-second timeout for the complete extraction process (Jina fetch + Claude processing). If the timeout is exceeded:
- Item status is set to 'failed'
- Error message: "Extraction timed out after 90 seconds"
- User can manually retry from UI

## Error States

The function handles these error scenarios:
1. **Item not found** - Returns 404
2. **No source URL** - Marks item as failed
3. **Jina fetch failure** - Marks item as failed with error
4. **Claude API error** - Marks item as failed with error
5. **Timeout** - Marks item as failed with timeout message
6. **Database update failure** - Marks item as failed

All errors are logged to Edge Function logs and stored in `items.extraction_error`.
