-- Collection forking feature
-- Allows users to fork public collections and track lineage

-- Track fork lineage
CREATE TABLE collection_forks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_collection_id uuid REFERENCES collections(id) ON DELETE SET NULL,
  forked_collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  forked_at timestamp with time zone DEFAULT now(),
  source_owner_username text,  -- Denormalized for display when source deleted
  source_collection_name text, -- Denormalized for display when source deleted
  UNIQUE(forked_collection_id)
);

-- Add fork metadata to collections
ALTER TABLE collections ADD COLUMN IF NOT EXISTS fork_count integer DEFAULT 0;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS is_forkable boolean DEFAULT true;

-- Add usernames to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Index for finding forks of a collection
CREATE INDEX IF NOT EXISTS idx_collection_forks_source ON collection_forks(source_collection_id);

-- RLS policies for collection_forks
ALTER TABLE collection_forks ENABLE ROW LEVEL SECURITY;

-- Anyone can view fork metadata (for public collections, we check via the collection)
CREATE POLICY "Fork metadata readable by anyone"
  ON collection_forks FOR SELECT
  USING (true);

-- Only authenticated users can create forks (checked in API)
CREATE POLICY "Authenticated users can create forks"
  ON collection_forks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Function to increment fork count (for trigger or direct call)
CREATE OR REPLACE FUNCTION increment_fork_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source_collection_id IS NOT NULL THEN
    UPDATE collections
    SET fork_count = fork_count + 1
    WHERE id = NEW.source_collection_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-increment fork count when a fork is created
CREATE TRIGGER on_fork_created
  AFTER INSERT ON collection_forks
  FOR EACH ROW
  EXECUTE FUNCTION increment_fork_count();

-- Function to decrement fork count when fork is deleted
CREATE OR REPLACE FUNCTION decrement_fork_count()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.source_collection_id IS NOT NULL THEN
    UPDATE collections
    SET fork_count = GREATEST(0, fork_count - 1)
    WHERE id = OLD.source_collection_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-decrement fork count when a fork is deleted
CREATE TRIGGER on_fork_deleted
  AFTER DELETE ON collection_forks
  FOR EACH ROW
  EXECUTE FUNCTION decrement_fork_count();
