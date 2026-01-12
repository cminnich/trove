-- Add extraction_status enum type
CREATE TYPE extraction_status AS ENUM ('pending', 'processing', 'complete', 'failed');

-- Add extraction_status column to items table
ALTER TABLE items
  ADD COLUMN extraction_status extraction_status DEFAULT 'complete',
  ADD COLUMN extraction_error text,
  ADD COLUMN extraction_started_at timestamp,
  ADD COLUMN extraction_completed_at timestamp;

-- Index for querying pending/failed items
CREATE INDEX items_extraction_status_idx ON items(extraction_status);

-- Update existing items to 'complete' status (already have data)
UPDATE items SET extraction_status = 'complete' WHERE title IS NOT NULL;

-- Make title nullable (since pending items won't have title yet)
ALTER TABLE items ALTER COLUMN title DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN items.extraction_status IS 'Tracks the status of async extraction: pending (inserted, awaiting processing), processing (extraction in progress), complete (extraction succeeded), failed (extraction failed, can retry)';
COMMENT ON COLUMN items.extraction_error IS 'Error message if extraction_status is failed';
COMMENT ON COLUMN items.extraction_started_at IS 'Timestamp when extraction started (status changed to processing)';
COMMENT ON COLUMN items.extraction_completed_at IS 'Timestamp when extraction completed (status changed to complete or failed)';
