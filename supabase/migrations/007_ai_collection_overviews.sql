-- Migration: 007_ai_collection_overviews.sql
-- Add AI-generated collection overview support
-- This enables thematic analysis, strategic insights, and relationship mapping for collections
--
-- If running manually through SQL editor, run this after applying:
-- INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('007_ai_collection_overviews') ON CONFLICT DO NOTHING;

-- Add AI overview columns to collections table
ALTER TABLE collections
  ADD COLUMN ai_overview TEXT NULL,
  ADD COLUMN ai_overview_generated_at TIMESTAMP NULL,
  ADD COLUMN ai_overview_model TEXT NULL,
  ADD COLUMN ai_overview_valid BOOLEAN NOT NULL DEFAULT false;

-- Index for checking cache validity
CREATE INDEX collections_ai_overview_valid_idx ON collections(ai_overview_valid);

-- Function to invalidate collection overview when items change
CREATE OR REPLACE FUNCTION invalidate_collection_overview()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Invalidate for INSERT or DELETE
  IF (TG_OP = 'INSERT' OR TG_OP = 'DELETE') THEN
    UPDATE collections
    SET ai_overview_valid = false
    WHERE id = COALESCE(NEW.collection_id, OLD.collection_id);

  -- Invalidate for UPDATE of position or notes
  ELSIF (TG_OP = 'UPDATE' AND (NEW.position IS DISTINCT FROM OLD.position OR NEW.notes IS DISTINCT FROM OLD.notes)) THEN
    UPDATE collections
    SET ai_overview_valid = false
    WHERE id = NEW.collection_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to invalidate overview when collection_items change
CREATE TRIGGER invalidate_overview_on_collection_items_change
  AFTER INSERT OR UPDATE OR DELETE ON collection_items
  FOR EACH ROW
  EXECUTE FUNCTION invalidate_collection_overview();

-- Comments for documentation
COMMENT ON COLUMN collections.ai_overview IS 'AI-generated JSON overview with themes, insights, and relationships';
COMMENT ON COLUMN collections.ai_overview_generated_at IS 'Timestamp when the overview was last generated';
COMMENT ON COLUMN collections.ai_overview_model IS 'Claude model used to generate the overview';
COMMENT ON COLUMN collections.ai_overview_valid IS 'False when collection items have changed since overview was generated';
COMMENT ON FUNCTION invalidate_collection_overview() IS 'Invalidates collection AI overview when items are added, removed, reordered, or notes change';
