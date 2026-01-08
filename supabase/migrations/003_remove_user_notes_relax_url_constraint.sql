-- Remove unused user_notes field from items table
-- This field was vestigial - all user-specific notes belong in collection_items.notes

ALTER TABLE items DROP COLUMN IF EXISTS user_notes;

-- Remove unique constraint from source_url to allow periodic re-extraction
-- This enables price tracking and refreshing stale data over time
-- Application logic will handle deduplication within a time window

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_source_url_key;

-- Keep source_url indexed for performance (non-unique)
CREATE INDEX IF NOT EXISTS items_source_url_idx ON items(source_url);

-- Add index on created_at for time-based deduplication queries
CREATE INDEX IF NOT EXISTS items_created_at_idx ON items(created_at);
