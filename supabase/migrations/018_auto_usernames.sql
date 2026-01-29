-- ============================================================================
-- MIGRATION 018: Automatic Username Generation
-- ============================================================================
-- This migration adds automatic username generation for new users with:
-- 1. PostgreSQL function to generate unique usernames
-- 2. Updated trigger to set username on user creation
-- Format: AdjectiveNounNumber (e.g., BraveEagle42)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Create function to generate unique usernames
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_unique_username()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  adjectives text[] := ARRAY[
    'Agile', 'Bold', 'Brave', 'Bright', 'Busy', 'Calm', 'Chill', 'Clever',
    'Cool', 'Crafty', 'Crisp', 'Curious', 'Daring', 'Deep', 'Eager', 'Epic',
    'Fair', 'Fast', 'Fine', 'Free', 'Fresh', 'Glad', 'Good', 'Grand', 'Green',
    'Happy', 'High', 'Jolly', 'Keen', 'Kind', 'Light', 'Loud', 'Lucky', 'Neat',
    'Nice', 'Noble', 'Odd', 'Pale', 'Proud', 'Pure', 'Quick', 'Rare', 'Real',
    'Rich', 'Safe', 'Sharp', 'Smart', 'Sure', 'Sweet', 'Swift', 'Tall', 'Tidy',
    'True', 'Vast', 'Warm', 'Wild', 'Wise', 'Zen', 'Zesty', 'Zippy'
  ];

  nouns text[] := ARRAY[
    'Badger', 'Bear', 'Beaver', 'Bird', 'Bison', 'Camel', 'Cat', 'Cobra',
    'Coder', 'Crane', 'Crow', 'Deer', 'Dingo', 'Dodo', 'Dog', 'Dolphin', 'Dove',
    'Duck', 'Eagle', 'Elk', 'Emu', 'Falcon', 'Ferret', 'Finch', 'Finder', 'Fish',
    'Fox', 'Frog', 'Gecko', 'Goat', 'Goose', 'Guide', 'Gull', 'Hare', 'Hawk',
    'Heron', 'Horse', 'Hunter', 'Keeper', 'Kiwi', 'Koala', 'Lark', 'Lemur',
    'Lion', 'Llama', 'Loon', 'Lynx', 'Magpie', 'Maker', 'Mole', 'Moose', 'Moth',
    'Mouse', 'Newt', 'Nomad', 'Otter', 'Owl', 'Panda', 'Pilot', 'Puma', 'Rabbit',
    'Racer', 'Ranger', 'Rat', 'Raven', 'Ray', 'Rider', 'Robin', 'Rogue', 'Scout',
    'Seal', 'Seeker', 'Shark', 'Sheep', 'Sloth', 'Snake', 'Snipe', 'Spider',
    'Squid', 'Stork', 'Swan', 'Swift', 'Tiger', 'Toad', 'Turtle', 'Walker',
    'Wasp', 'Whale', 'Wolf', 'Wren', 'Yak', 'Zebra'
  ];

  v_username text;
  v_adjective text;
  v_noun text;
  v_number int;
  v_exists boolean;
  v_attempts int := 0;
  v_max_attempts int := 100;
BEGIN
  LOOP
    -- Safety check to prevent infinite loops
    v_attempts := v_attempts + 1;
    IF v_attempts > v_max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique username after % attempts', v_max_attempts;
    END IF;

    -- Pick random words and number
    v_adjective := adjectives[1 + floor(random() * array_length(adjectives, 1))::int];
    v_noun := nouns[1 + floor(random() * array_length(nouns, 1))::int];
    v_number := 10 + floor(random() * 90)::int; -- Random number between 10-99

    -- Construct username in PascalCase
    v_username := v_adjective || v_noun || v_number;

    -- Check if username exists
    SELECT EXISTS(
      SELECT 1 FROM profiles WHERE username = v_username
    ) INTO v_exists;

    -- If unique, return it
    IF NOT v_exists THEN
      RETURN v_username;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION generate_unique_username() IS 'Generates a unique username in the format AdjectiveNounNumber (e.g., BraveEagle42)';

-- ----------------------------------------------------------------------------
-- STEP 2: Update handle_new_user trigger to set username
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, avatar_url, username)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    generate_unique_username()
  );
  RETURN new;
END;
$$;

COMMENT ON FUNCTION handle_new_user() IS 'Auto-creates profile row with unique username when new user signs up via Supabase Auth';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
