-- Add item_type column for domain-aware extraction
-- This is the "Librarian" tier - system-level classification for AI reasoning

ALTER TABLE items ADD COLUMN item_type text DEFAULT 'product';

-- Index for efficient filtering by item type (e.g., "show all my watches")
CREATE INDEX items_item_type_idx ON items(item_type);

-- Document the purpose
COMMENT ON COLUMN items.item_type IS 'System-level type for schema selection (watch, wine, product, etc.). Auto-detected by Claude during extraction.';
