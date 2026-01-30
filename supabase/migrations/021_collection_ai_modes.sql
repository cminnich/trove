-- Migration: Add AI Mode to Collections
-- Adds ai_mode column to support different AI personas (Standard, Researcher, Curator)

-- Add ai_mode column to collections table
ALTER TABLE collections
ADD COLUMN ai_mode text NOT NULL DEFAULT 'standard'
CHECK (ai_mode IN ('standard', 'researcher', 'curator'));

-- Create index for filtering by ai_mode (optional, for analytics)
CREATE INDEX idx_collections_ai_mode ON collections(ai_mode);

-- Comment for documentation
COMMENT ON COLUMN collections.ai_mode IS 'AI persona mode: standard (general insights), researcher (gap analysis), curator (redundancy detection)';
