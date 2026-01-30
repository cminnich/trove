-- User identity and social profile fields
-- Adds bio, website, and social links to profiles

-- Add identity fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_reddit text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_x text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_github text;

-- Add check constraints for character limits and URL formats
ALTER TABLE profiles
  ADD CONSTRAINT bio_length_check
  CHECK (bio IS NULL OR char_length(bio) <= 160);

-- Add check constraints for social usernames (alphanumeric, hyphens, underscores)
ALTER TABLE profiles
  ADD CONSTRAINT social_reddit_format_check
  CHECK (social_reddit IS NULL OR social_reddit ~ '^[a-zA-Z0-9_-]{1,20}$');

ALTER TABLE profiles
  ADD CONSTRAINT social_x_format_check
  CHECK (social_x IS NULL OR social_x ~ '^[a-zA-Z0-9_]{1,15}$');

ALTER TABLE profiles
  ADD CONSTRAINT social_github_format_check
  CHECK (social_github IS NULL OR social_github ~ '^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$');

-- Website URL check (basic validation)
ALTER TABLE profiles
  ADD CONSTRAINT website_format_check
  CHECK (website IS NULL OR website ~ '^https?://');

-- Add comment for documentation
COMMENT ON COLUMN profiles.bio IS 'Short bio/headline, max 160 characters';
COMMENT ON COLUMN profiles.website IS 'Personal website URL';
COMMENT ON COLUMN profiles.social_reddit IS 'Reddit username (without u/ prefix)';
COMMENT ON COLUMN profiles.social_x IS 'X/Twitter username (without @ prefix)';
COMMENT ON COLUMN profiles.social_github IS 'GitHub username';
