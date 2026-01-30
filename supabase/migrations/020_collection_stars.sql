-- Collection starring feature
-- Allows users to star (bookmark/follow) public collections owned by others

-- Track collection stars
CREATE TABLE collection_stars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, collection_id)  -- Prevent duplicate stars
);

-- Add star count to collections (denormalized for performance)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS star_count integer DEFAULT 0;

-- Index for finding all stars by a user (fast lookup for "my starred items")
CREATE INDEX IF NOT EXISTS idx_collection_stars_user ON collection_stars(user_id);

-- Index for finding all stars of a collection (fast star count queries)
CREATE INDEX IF NOT EXISTS idx_collection_stars_collection ON collection_stars(collection_id);

-- RLS policies for collection_stars
ALTER TABLE collection_stars ENABLE ROW LEVEL SECURITY;

-- Users can see their own stars
CREATE POLICY "Users can view their own stars"
  ON collection_stars FOR SELECT
  USING (user_id = auth.uid());

-- Users can star collections
CREATE POLICY "Authenticated users can star collections"
  ON collection_stars FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can unstar (delete) their own stars
CREATE POLICY "Users can delete their own stars"
  ON collection_stars FOR DELETE
  USING (user_id = auth.uid());

-- Function to increment star count when a star is created
CREATE OR REPLACE FUNCTION increment_star_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE collections
  SET star_count = star_count + 1
  WHERE id = NEW.collection_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-increment star count when a star is created
CREATE TRIGGER on_star_created
  AFTER INSERT ON collection_stars
  FOR EACH ROW
  EXECUTE FUNCTION increment_star_count();

-- Function to decrement star count when a star is deleted
CREATE OR REPLACE FUNCTION decrement_star_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE collections
  SET star_count = GREATEST(0, star_count - 1)
  WHERE id = OLD.collection_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-decrement star count when a star is deleted
CREATE TRIGGER on_star_deleted
  AFTER DELETE ON collection_stars
  FOR EACH ROW
  EXECUTE FUNCTION decrement_star_count();
