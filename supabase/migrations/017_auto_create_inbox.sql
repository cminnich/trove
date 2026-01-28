-- ============================================================================
-- MIGRATION 017: Auto-Create Inbox Collection on User Signup
-- ============================================================================
-- Problem: The Inbox collection was created client-side in the API route,
-- which could cause duplicate Inboxes if the user refreshed the page during
-- initial load or if there were race conditions.
--
-- Solution: Create the Inbox collection atomically in the database trigger
-- when a new user signs up. This guarantees exactly one Inbox per user.
--
-- Changes:
-- 1. Update handle_new_user() trigger function to create Inbox collection
-- 2. Backfill Inbox collections for existing users without one
--
-- Why this works:
-- - The Inbox is created in the same transaction as the profile
-- - It's impossible for a user to exist without an Inbox
-- - It's impossible for the client to accidentally create duplicates
-- - The database guarantees consistency through the trigger
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Update handle_new_user() to create Inbox collection
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Create Inbox collection for the new user
  -- The Inbox is always private, regardless of user's default visibility preference
  INSERT INTO public.collections (
    owner_id,
    name,
    type,
    visibility,
    description
  ) VALUES (
    new.id,
    'Inbox',
    'inbox',
    'private',
    'Default collection for new items'
  );

  RETURN new;
END;
$$;

COMMENT ON FUNCTION handle_new_user() IS 'Auto-creates profile and Inbox collection when new user signs up via Supabase Auth';

-- ----------------------------------------------------------------------------
-- STEP 2: Backfill Inbox collections for existing users
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  user_record RECORD;
  inbox_count INTEGER;
BEGIN
  -- For each user in profiles
  FOR user_record IN
    SELECT id FROM profiles
  LOOP
    -- Check if this user already has an Inbox collection
    SELECT COUNT(*) INTO inbox_count
    FROM collections
    WHERE owner_id = user_record.id
      AND type = 'inbox'
      AND name = 'Inbox';

    -- If no Inbox exists, create one
    IF inbox_count = 0 THEN
      INSERT INTO collections (
        owner_id,
        name,
        type,
        visibility,
        description
      ) VALUES (
        user_record.id,
        'Inbox',
        'inbox',
        'private',
        'Default collection for new items'
      );

      RAISE NOTICE 'Created Inbox collection for user %', user_record.id;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Remove inbox creation logic from app/api/collections/route.ts
-- 2. The database now guarantees every user has exactly one Inbox
-- ============================================================================
