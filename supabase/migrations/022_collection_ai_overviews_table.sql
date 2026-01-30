-- Migration: Create collection_ai_overviews table and add custom mode
-- Preserves AI-generated overviews per mode so switching modes doesn't lose previous analyses

-- 1. Create new table for storing AI-generated collection overviews
CREATE TABLE collection_ai_overviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  ai_mode TEXT NOT NULL CHECK (ai_mode IN ('standard', 'researcher', 'curator', 'custom')),
  overview TEXT NOT NULL, -- markdown output
  model TEXT NOT NULL, -- e.g., 'claude-3-5-sonnet-20240620'
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure only one overview per collection per mode (latest overwrites)
  UNIQUE(collection_id, ai_mode)
);

-- Create index for fast lookups
CREATE INDEX idx_collection_ai_overviews_collection_mode
  ON collection_ai_overviews(collection_id, ai_mode);

-- Add RLS policies
ALTER TABLE collection_ai_overviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view overviews for their collections"
  ON collection_ai_overviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_ai_overviews.collection_id
        AND collections.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert overviews for their collections"
  ON collection_ai_overviews FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_ai_overviews.collection_id
        AND collections.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update overviews for their collections"
  ON collection_ai_overviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_ai_overviews.collection_id
        AND collections.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete overviews for their collections"
  ON collection_ai_overviews FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_ai_overviews.collection_id
        AND collections.owner_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON TABLE collection_ai_overviews IS 'Stores AI-generated collection overviews per mode, allowing users to preserve analyses when switching between AI personas';

-- 2. Update ai_mode constraint to include 'custom'
-- Drop existing constraint
ALTER TABLE collections
DROP CONSTRAINT IF EXISTS collections_ai_mode_check;

-- Add new constraint with 'custom' mode
ALTER TABLE collections
ADD CONSTRAINT collections_ai_mode_check
CHECK (ai_mode IN ('standard', 'researcher', 'curator', 'custom'));

-- Update comment
COMMENT ON COLUMN collections.ai_mode IS 'AI persona mode: standard (general insights), researcher (gap analysis), curator (redundancy detection), custom (user-defined prompt)';

-- 3. Migrate existing ai_overview data to new table
-- This preserves existing overviews when users upgrade
INSERT INTO collection_ai_overviews (collection_id, ai_mode, overview, model, generated_at)
SELECT
  id,
  ai_mode,
  ai_overview,
  COALESCE(ai_overview_model, 'claude-3-5-sonnet-20240620'),
  COALESCE(ai_overview_generated_at, NOW())
FROM collections
WHERE ai_overview IS NOT NULL
ON CONFLICT (collection_id, ai_mode) DO NOTHING;

-- 4. OPTIONAL: Drop old columns after verifying migration works
-- Recommend keeping them initially in case we need to rollback
-- Can be removed in a future migration once we're confident
--
-- ALTER TABLE collections DROP COLUMN ai_overview;
-- ALTER TABLE collections DROP COLUMN ai_overview_generated_at;
-- ALTER TABLE collections DROP COLUMN ai_overview_model;
-- ALTER TABLE collections DROP COLUMN ai_overview_valid;
