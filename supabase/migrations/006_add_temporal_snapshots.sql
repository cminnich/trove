-- Migration: 006_add_temporal_snapshots.sql
-- Add temporal snapshot support to track item changes over time
-- This allows capturing price changes, sales, formulation updates, etc.
--
-- If running manually through SQL editor, run this after applying:
-- INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('006_add_temporal_snapshots') ON CONFLICT DO NOTHING;

-- Create item_snapshots table to store historical data
CREATE TABLE item_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

  -- Snapshot data (what changed over time)
  price NUMERIC,
  currency TEXT,
  image_url TEXT,
  raw_markdown TEXT,

  -- Snapshot metadata
  captured_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add fields to items table to track snapshot state
ALTER TABLE items
  ADD COLUMN last_extracted_at TIMESTAMP,
  ADD COLUMN current_snapshot_id UUID REFERENCES item_snapshots(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX item_snapshots_item_id_idx ON item_snapshots(item_id);
CREATE INDEX item_snapshots_captured_at_idx ON item_snapshots(captured_at DESC);
CREATE INDEX items_last_extracted_at_idx ON items(last_extracted_at);
CREATE INDEX items_source_url_last_extracted_idx ON items(source_url, last_extracted_at DESC);

-- Enable RLS on item_snapshots (inherit from items table)
ALTER TABLE item_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow users to see snapshots for items they can see
CREATE POLICY "Users can view snapshots for items they can access"
  ON item_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = item_snapshots.item_id
    )
  );

-- Allow authenticated users to insert snapshots (through API)
CREATE POLICY "Authenticated users can create snapshots"
  ON item_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);
