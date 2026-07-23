-- Per-user opt-in for the Trove Assistant (in-app AI chat).
-- The assistant consumes the operator's Anthropic API tokens, so it is OFF by
-- default; the operator enables specific profiles.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS assistant_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.assistant_enabled IS
  'Whether this user may use the in-app AI assistant (/api/chat). Off by default; enabled per-user by the operator.';

-- To authorize a user, run e.g.:
--   UPDATE profiles SET assistant_enabled = true WHERE email = 'you@example.com';
