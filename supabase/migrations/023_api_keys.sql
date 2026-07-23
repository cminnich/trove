-- API Keys table for public API authentication
-- Keys are stored as SHA-256 hashes; the plaintext is shown once at creation

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  key_prefix TEXT NOT NULL,        -- first 16 chars for display (trove_sk_xxxxx...)
  key_hash TEXT NOT NULL,          -- SHA-256 hex digest of full key
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ           -- NULL = never expires
);

-- Unique index on hash for fast lookup during auth
CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys (key_hash);

-- Index on user_id for listing a user's keys
CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);

-- RLS: users can only manage their own keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);
