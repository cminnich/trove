-- Migration: Collection Attribute Schemas
-- Creates collection-level attribute schemas for AI-discovered filters

-- 1. Collection Attribute Schemas: Per-collection AI-discovered filter definitions
CREATE TABLE IF NOT EXISTS collection_attribute_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,

  -- Schema definition
  name TEXT NOT NULL,                    -- e.g., "burr_type"
  display_name TEXT NOT NULL,            -- e.g., "Burr Type"
  description TEXT,                      -- AI-generated description
  source_path TEXT NOT NULL,             -- JSON path: "attributes.burr_type"
  value_type TEXT DEFAULT 'string',      -- string, number, numeric_range

  -- For numeric ranges (optional)
  range_config JSONB,                    -- e.g., [{"min":40,"max":50,"label":"40-50mm"}]

  -- AI metadata
  discovery_confidence NUMERIC(3,2),     -- 0.0-1.0
  sample_values JSONB,                   -- ["conical", "flat"]
  item_coverage NUMERIC(3,2),            -- What % of items have this attr

  -- Visibility (mirrors existing filter_preferences pattern)
  is_visible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 999,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(collection_id, name)
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_coll_schemas_collection ON collection_attribute_schemas(collection_id);
CREATE INDEX IF NOT EXISTS idx_coll_schemas_visible ON collection_attribute_schemas(collection_id, is_visible);

-- 2. Extend item_attributes to support collection-level schemas
-- Add column for collection schema reference
ALTER TABLE item_attributes
ADD COLUMN IF NOT EXISTS collection_schema_id UUID REFERENCES collection_attribute_schemas(id) ON DELETE CASCADE;

-- Make schema_id nullable (one of schema_id or collection_schema_id must be set)
ALTER TABLE item_attributes ALTER COLUMN schema_id DROP NOT NULL;

-- Add constraint to ensure one of schema_id or collection_schema_id is set
-- First drop the constraint if it exists (for idempotency)
ALTER TABLE item_attributes DROP CONSTRAINT IF EXISTS item_attr_schema_check;
ALTER TABLE item_attributes ADD CONSTRAINT item_attr_schema_check
  CHECK (schema_id IS NOT NULL OR collection_schema_id IS NOT NULL);

-- Update the unique constraint to handle collection schemas
-- Drop the old unique constraint
ALTER TABLE item_attributes DROP CONSTRAINT IF EXISTS item_attributes_item_id_schema_id_key;

-- Create a new unique index that allows for either schema type
CREATE UNIQUE INDEX IF NOT EXISTS item_attributes_item_schema_unique
  ON item_attributes(item_id, COALESCE(schema_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(collection_schema_id, '00000000-0000-0000-0000-000000000000'::UUID));

-- Index for collection schema lookups
CREATE INDEX IF NOT EXISTS idx_item_attributes_collection_schema ON item_attributes(collection_schema_id) WHERE collection_schema_id IS NOT NULL;

-- 3. RLS Policies for collection_attribute_schemas

ALTER TABLE collection_attribute_schemas ENABLE ROW LEVEL SECURITY;

-- Read policy: anyone who can view the collection can see its schemas
CREATE POLICY "Collection schemas readable by collection viewers"
  ON collection_attribute_schemas FOR SELECT
  TO authenticated
  USING (user_can_view_collection(collection_id, auth.uid()));

-- Write policies: only collection owner or editors
CREATE POLICY "Collection schemas insertable by collection editors"
  ON collection_attribute_schemas FOR INSERT
  TO authenticated
  WITH CHECK (user_can_manage_collection_filters(collection_id, auth.uid()));

CREATE POLICY "Collection schemas updatable by collection editors"
  ON collection_attribute_schemas FOR UPDATE
  TO authenticated
  USING (user_can_manage_collection_filters(collection_id, auth.uid()));

CREATE POLICY "Collection schemas deletable by collection editors"
  ON collection_attribute_schemas FOR DELETE
  TO authenticated
  USING (user_can_manage_collection_filters(collection_id, auth.uid()));

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_collection_attribute_schemas_updated_at
  BEFORE UPDATE ON collection_attribute_schemas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
