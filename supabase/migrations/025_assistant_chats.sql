-- Persistent conversations for the Trove Assistant.
-- One row per chat thread; the full UIMessage array is stored as JSONB and
-- rewritten by /api/chat when each response finishes.

CREATE TABLE IF NOT EXISTS assistant_chats (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_chats_user_recency
  ON assistant_chats (user_id, updated_at DESC);

ALTER TABLE assistant_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assistant chats"
  ON assistant_chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assistant chats"
  ON assistant_chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assistant chats"
  ON assistant_chats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assistant chats"
  ON assistant_chats FOR DELETE
  USING (auth.uid() = user_id);
