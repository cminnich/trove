-- Add custom_prompt column to collections table for collection-specific AI agent prompts
-- This allows users to customize the AI Curator's behavior for each collection

ALTER TABLE collections
ADD COLUMN custom_prompt TEXT DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN collections.custom_prompt IS 'Custom AI agent prompt template. If null, uses system default. Supports variables: {{COLLECTION_NAME}}, {{COLLECTION_DESCRIPTION}}, {{COLLECTION_TYPE}}, {{ITEM_COUNT}}, {{ITEMS_JSON}}';
