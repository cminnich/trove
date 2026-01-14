-- Add default_visibility preference to profiles table
-- This controls whether new collections are public or private by default
-- Default is 'public' to encourage sharing and AI features

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS default_visibility TEXT DEFAULT 'public' CHECK (default_visibility IN ('public', 'private'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_default_visibility ON profiles(default_visibility);

-- Add comment for documentation
COMMENT ON COLUMN profiles.default_visibility IS 'Default visibility for new collections created by this user. Public enables AI features, private disables them.';
