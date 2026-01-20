-- Migration: Collection Filter Preferences
-- Allows users to customize which attribute filters are visible per collection

-- Collection Filter Preferences: Per-collection visibility overrides
CREATE TABLE IF NOT EXISTS collection_filter_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  schema_id UUID NOT NULL REFERENCES attribute_schemas(id) ON DELETE CASCADE,
  is_hidden BOOLEAN DEFAULT false,    -- true = force hide this filter
  force_show BOOLEAN DEFAULT false,   -- true = always show even if auto-hidden
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, schema_id)
);

-- Index for fast lookups by collection
CREATE INDEX IF NOT EXISTS idx_collection_filter_prefs_collection_id
  ON collection_filter_preferences(collection_id);

-- RLS Policies
ALTER TABLE collection_filter_preferences ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user can view a collection
CREATE OR REPLACE FUNCTION user_can_view_collection(p_collection_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    LEFT JOIN collection_access ca ON c.id = ca.collection_id
    WHERE c.id = p_collection_id
    AND (
      c.visibility = 'public'
      OR c.owner_id = p_user_id
      OR ca.user_id = p_user_id
      OR ca.invited_identity IN (
        SELECT email FROM profiles WHERE id = p_user_id
        UNION
        SELECT phone FROM profiles WHERE id = p_user_id
      )
    )
  );
$$;

-- Helper function to check if user can manage collection filter preferences
-- User must be collection owner or have editor access
CREATE OR REPLACE FUNCTION user_can_manage_collection_filters(p_collection_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    LEFT JOIN collection_access ca ON c.id = ca.collection_id
    WHERE c.id = p_collection_id
    AND (
      c.owner_id = p_user_id
      OR (ca.user_id = p_user_id AND ca.access_level = 'editor')
      OR (
        ca.access_level = 'editor'
        AND ca.invited_identity IN (
          SELECT email FROM profiles WHERE id = p_user_id
          UNION
          SELECT phone FROM profiles WHERE id = p_user_id
        )
      )
    )
  );
$$;

-- Read policy: anyone who can view the collection can see filter preferences
CREATE POLICY "Collection filter preferences readable by collection viewers"
  ON collection_filter_preferences FOR SELECT
  TO authenticated
  USING (user_can_view_collection(collection_id, auth.uid()));

-- Write policies: only collection owner or editors
CREATE POLICY "Collection filter preferences insertable by collection editors"
  ON collection_filter_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_can_manage_collection_filters(collection_id, auth.uid()));

CREATE POLICY "Collection filter preferences updatable by collection editors"
  ON collection_filter_preferences FOR UPDATE
  TO authenticated
  USING (user_can_manage_collection_filters(collection_id, auth.uid()));

CREATE POLICY "Collection filter preferences deletable by collection editors"
  ON collection_filter_preferences FOR DELETE
  TO authenticated
  USING (user_can_manage_collection_filters(collection_id, auth.uid()));

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_collection_filter_prefs_updated_at
  BEFORE UPDATE ON collection_filter_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
