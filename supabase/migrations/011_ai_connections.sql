-- Migration: AI-Powered Connections
-- Creates tables for semantic attribute management and filtering

-- 1. Attribute Schemas: System-defined attribute categories
-- These define what types of attributes can be extracted and how they're displayed
CREATE TABLE IF NOT EXISTS attribute_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,          -- e.g., 'brand', 'price_range', 'color'
  display_name TEXT NOT NULL,         -- e.g., 'Brand', 'Price Range', 'Color'
  description TEXT,                   -- Human-readable description
  source_type TEXT NOT NULL,          -- 'direct' (from item fields), 'computed' (derived), 'extracted' (AI)
  source_field TEXT,                  -- For 'direct' type: which item field (e.g., 'brand', 'retailer')
  is_active BOOLEAN DEFAULT true,     -- Soft disable without deleting
  display_order INTEGER DEFAULT 0,    -- Order in UI
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Item Attributes: Normalized attribute values for each item
-- One row per (item, schema) pair - stores the extracted/computed value
CREATE TABLE IF NOT EXISTS item_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  schema_id UUID NOT NULL REFERENCES attribute_schemas(id) ON DELETE CASCADE,
  raw_value TEXT NOT NULL,            -- Original value (e.g., 'Rolex', '$127.99')
  normalized_value TEXT NOT NULL,     -- Normalized for comparison (e.g., 'rolex', '100-250')
  group_key TEXT NOT NULL,            -- Filtering key (e.g., 'brand:rolex', 'price_range:100-250')
  confidence NUMERIC(3,2),            -- Extraction confidence (0.00-1.00)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, schema_id)          -- One attribute per schema per item
);

-- 3. User Pinned Connections: User preferences for visible attribute filters
-- Allows users to hide/show specific attribute types in the filter UI
CREATE TABLE IF NOT EXISTS user_pinned_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_id UUID NOT NULL REFERENCES attribute_schemas(id) ON DELETE CASCADE,
  is_pinned BOOLEAN DEFAULT true,     -- Whether to show in filter UI
  display_order INTEGER DEFAULT 0,    -- Custom order for this user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, schema_id)
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_item_attributes_item_id ON item_attributes(item_id);
CREATE INDEX IF NOT EXISTS idx_item_attributes_group_key ON item_attributes(group_key);
CREATE INDEX IF NOT EXISTS idx_item_attributes_schema_id ON item_attributes(schema_id);
CREATE INDEX IF NOT EXISTS idx_user_pinned_connections_user_id ON user_pinned_connections(user_id);

-- Insert default attribute schemas
INSERT INTO attribute_schemas (name, display_name, description, source_type, source_field, display_order)
VALUES
  ('brand', 'Brand', 'Product brand or manufacturer', 'direct', 'brand', 1),
  ('price_range', 'Price Range', 'Price bucket for filtering', 'computed', 'price', 2),
  ('category', 'Category', 'Product category', 'direct', 'category', 3),
  ('retailer', 'Retailer', 'Store or website', 'direct', 'retailer', 4),
  ('color', 'Color', 'Primary color of the item', 'extracted', NULL, 5),
  ('material', 'Material', 'Primary material', 'extracted', NULL, 6),
  ('item_type', 'Type', 'Item type classification', 'direct', 'item_type', 7)
ON CONFLICT (name) DO NOTHING;

-- RLS Policies

-- attribute_schemas: Public read (system-defined)
ALTER TABLE attribute_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attribute schemas are publicly readable"
  ON attribute_schemas FOR SELECT
  TO authenticated
  USING (true);

-- item_attributes: Read if you can access the item, write for authenticated users
ALTER TABLE item_attributes ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user can access an item (via collection membership)
CREATE OR REPLACE FUNCTION user_can_access_item(p_item_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collection_items ci
    JOIN collections c ON ci.collection_id = c.id
    LEFT JOIN collection_access ca ON c.id = ca.collection_id
    WHERE ci.item_id = p_item_id
    AND (
      c.owner_id = p_user_id
      OR ca.user_id = p_user_id
      OR ca.invited_identity IN (
        SELECT email FROM profiles WHERE id = p_user_id
        UNION
        SELECT phone FROM profiles WHERE id = p_user_id
      )
    )
  );
$$;

CREATE POLICY "Item attributes readable by item owners"
  ON item_attributes FOR SELECT
  TO authenticated
  USING (user_can_access_item(item_id, auth.uid()));

CREATE POLICY "Authenticated users can insert item attributes"
  ON item_attributes FOR INSERT
  TO authenticated
  WITH CHECK (user_can_access_item(item_id, auth.uid()));

CREATE POLICY "Authenticated users can update item attributes"
  ON item_attributes FOR UPDATE
  TO authenticated
  USING (user_can_access_item(item_id, auth.uid()));

CREATE POLICY "Authenticated users can delete item attributes"
  ON item_attributes FOR DELETE
  TO authenticated
  USING (user_can_access_item(item_id, auth.uid()));

-- user_pinned_connections: User-specific access
ALTER TABLE user_pinned_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own pinned connections"
  ON user_pinned_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own pinned connections"
  ON user_pinned_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pinned connections"
  ON user_pinned_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own pinned connections"
  ON user_pinned_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_item_attributes_updated_at
  BEFORE UPDATE ON item_attributes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_pinned_connections_updated_at
  BEFORE UPDATE ON user_pinned_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
