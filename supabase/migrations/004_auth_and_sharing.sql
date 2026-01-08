-- ============================================================================
-- MIGRATION 004: Authentication and Multi-User Sharing System
-- ============================================================================
-- This migration transforms Trove from single-user to multi-user with:
-- 1. Supabase Auth integration (Google OAuth)
-- 2. Profiles table synced with auth.users
-- 3. Collection visibility (public/private)
-- 4. Collection sharing with email/phone invitations
-- 5. Row-Level Security (RLS) policies
-- 6. Identity claiming for pre-signup invitations
--
-- NOTE: This migration has an RLS infinite recursion bug in the collections
-- policy. Run migration 005 immediately after this to fix it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Drop old users table (placeholder table, no real data)
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS users CASCADE;

-- ----------------------------------------------------------------------------
-- STEP 2: Create profiles table (synced with auth.users)
-- ----------------------------------------------------------------------------

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  phone text UNIQUE,
  avatar_url text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes for performance
CREATE INDEX profiles_email_idx ON profiles(email);
CREATE INDEX profiles_phone_idx ON profiles(phone);

-- Apply updated_at trigger to profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE profiles IS 'User profiles synced from auth.users. Supports email and phone identity claiming.';

-- ----------------------------------------------------------------------------
-- STEP 3: Create auth trigger to auto-create profile on signup
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

COMMENT ON FUNCTION handle_new_user() IS 'Auto-creates profile row when new user signs up via Supabase Auth';

-- ----------------------------------------------------------------------------
-- STEP 4: Migrate collections table to multi-user
-- ----------------------------------------------------------------------------

-- Add owner_id and visibility columns
ALTER TABLE collections
  ADD COLUMN owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'private'));

-- Remove old user_id column (was referencing deleted users table)
ALTER TABLE collections DROP COLUMN IF EXISTS user_id;

-- Index for performance
CREATE INDEX collections_owner_id_idx ON collections(owner_id);
CREATE INDEX collections_visibility_idx ON collections(visibility);

COMMENT ON COLUMN collections.owner_id IS 'Collection owner (creator). NULL for orphaned collections (can be claimed by first user).';
COMMENT ON COLUMN collections.visibility IS 'Public collections are viewable by anyone. Private collections require explicit access grants.';

-- ----------------------------------------------------------------------------
-- STEP 5: Create collection_access table for sharing
-- ----------------------------------------------------------------------------

CREATE TABLE collection_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,

  -- Identity-based invitations (pre-signup)
  invited_identity text NOT NULL, -- email or phone number

  -- Claimed by user (post-signup)
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,

  -- Access control
  access_level text NOT NULL CHECK (access_level IN ('viewer', 'editor')),
  expires_at timestamp, -- NULL = permanent access

  -- Metadata
  granted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_at timestamp DEFAULT now(),
  claimed_at timestamp, -- When user_id was populated

  -- Prevent duplicate invitations
  UNIQUE(collection_id, invited_identity)
);

-- Indexes for performance
CREATE INDEX collection_access_collection_id_idx ON collection_access(collection_id);
CREATE INDEX collection_access_user_id_idx ON collection_access(user_id);
CREATE INDEX collection_access_invited_identity_idx ON collection_access(invited_identity);

COMMENT ON TABLE collection_access IS 'Sharing permissions for collections. Supports pre-signup invitations via email/phone that are claimed on user signup.';
COMMENT ON COLUMN collection_access.invited_identity IS 'Email or phone number of invitee. Can be claimed by matching profile.';
COMMENT ON COLUMN collection_access.user_id IS 'Populated when user with matching email/phone signs up and claims the invitation.';
COMMENT ON COLUMN collection_access.access_level IS 'viewer = read-only, editor = can add/edit/remove items';
COMMENT ON COLUMN collection_access.expires_at IS 'NULL = permanent access. Future feature for temporary sharing.';

-- ----------------------------------------------------------------------------
-- STEP 6: Create identity claiming trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_collection_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Claim by email
  IF NEW.email IS NOT NULL THEN
    UPDATE collection_access
    SET user_id = NEW.id, claimed_at = now()
    WHERE invited_identity = NEW.email
      AND user_id IS NULL;
  END IF;

  -- Claim by phone
  IF NEW.phone IS NOT NULL THEN
    UPDATE collection_access
    SET user_id = NEW.id, claimed_at = now()
    WHERE invited_identity = NEW.phone
      AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_identity_update
  AFTER INSERT OR UPDATE OF email, phone ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION claim_collection_access();

COMMENT ON FUNCTION claim_collection_access() IS 'Automatically claims pending collection invitations when user signs up or verifies new identity.';

-- ----------------------------------------------------------------------------
-- STEP 7: Enable Row-Level Security (RLS)
-- ----------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- STEP 8: RLS Policies - Profiles
-- ----------------------------------------------------------------------------

-- Users can read their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Profiles are created via trigger (no direct INSERT policy needed)

COMMENT ON POLICY "Users can view their own profile" ON profiles IS 'Users can only see their own profile data.';

-- ----------------------------------------------------------------------------
-- STEP 9: RLS Policies - Items (Global Librarian)
-- ----------------------------------------------------------------------------

-- Anyone can read items (objective facts are public)
CREATE POLICY "Items are publicly readable"
  ON items FOR SELECT
  USING (true);

-- Only authenticated users can create items
CREATE POLICY "Authenticated users can create items"
  ON items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Items are immutable after creation (no UPDATE/DELETE)
-- Future: Add policies for price refresh/staleness updates

COMMENT ON POLICY "Items are publicly readable" ON items IS 'Items table is a global librarian - objective facts are readable by everyone.';
COMMENT ON POLICY "Authenticated users can create items" ON items IS 'Only authenticated users can add items to the global librarian.';

-- ----------------------------------------------------------------------------
-- STEP 10: RLS Policies - Collections
-- ----------------------------------------------------------------------------

-- Read: Public collections OR owned OR shared with you
CREATE POLICY "Collections are readable based on visibility and access"
  ON collections FOR SELECT
  USING (
    visibility = 'public'
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM collection_access
      WHERE collection_access.collection_id = collections.id
        AND (
          collection_access.user_id = auth.uid()
          OR collection_access.invited_identity IN (
            SELECT email FROM profiles WHERE id = auth.uid()
            UNION
            SELECT phone FROM profiles WHERE id = auth.uid()
          )
        )
        AND (collection_access.expires_at IS NULL OR collection_access.expires_at > now())
    )
  );

-- Insert: Only authenticated users can create collections (owner_id = current user)
CREATE POLICY "Users can create their own collections"
  ON collections FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- Update: Only owners can update collections
CREATE POLICY "Users can update their own collections"
  ON collections FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Delete: Only owners can delete collections
CREATE POLICY "Users can delete their own collections"
  ON collections FOR DELETE
  USING (owner_id = auth.uid());

COMMENT ON POLICY "Collections are readable based on visibility and access" ON collections IS 'Public collections visible to all. Private collections only to owner and shared users.';

-- ----------------------------------------------------------------------------
-- STEP 11: RLS Policies - Collection Items
-- ----------------------------------------------------------------------------

-- Read: Inherit from parent collection permissions
CREATE POLICY "Collection items inherit collection read permissions"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
        AND (
          collections.visibility = 'public'
          OR collections.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM collection_access
            WHERE collection_access.collection_id = collections.id
              AND (
                collection_access.user_id = auth.uid()
                OR collection_access.invited_identity IN (
                  SELECT email FROM profiles WHERE id = auth.uid()
                  UNION
                  SELECT phone FROM profiles WHERE id = auth.uid()
                )
              )
              AND (collection_access.expires_at IS NULL OR collection_access.expires_at > now())
          )
        )
    )
  );

-- Insert/Update/Delete: Only collection owner OR editors
CREATE POLICY "Collection owners and editors can manage items"
  ON collection_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
        AND (
          collections.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM collection_access
            WHERE collection_access.collection_id = collections.id
              AND collection_access.access_level = 'editor'
              AND (
                collection_access.user_id = auth.uid()
                OR collection_access.invited_identity IN (
                  SELECT email FROM profiles WHERE id = auth.uid()
                  UNION
                  SELECT phone FROM profiles WHERE id = auth.uid()
                )
              )
              AND (collection_access.expires_at IS NULL OR collection_access.expires_at > now())
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
        AND (
          collections.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM collection_access
            WHERE collection_access.collection_id = collections.id
              AND collection_access.access_level = 'editor'
              AND (
                collection_access.user_id = auth.uid()
                OR collection_access.invited_identity IN (
                  SELECT email FROM profiles WHERE id = auth.uid()
                  UNION
                  SELECT phone FROM profiles WHERE id = auth.uid()
                )
              )
              AND (collection_access.expires_at IS NULL OR collection_access.expires_at > now())
          )
        )
    )
  );

COMMENT ON POLICY "Collection items inherit collection read permissions" ON collection_items IS 'Can read items if you can read the parent collection.';
COMMENT ON POLICY "Collection owners and editors can manage items" ON collection_items IS 'Only collection owner or users with editor access can modify items.';

-- ----------------------------------------------------------------------------
-- STEP 12: RLS Policies - Collection Access
-- ----------------------------------------------------------------------------

-- Read: Collection owner can see all access grants, users can see their own
CREATE POLICY "Collection owners and invitees can view access"
  ON collection_access FOR SELECT
  USING (
    granted_by = auth.uid()
    OR user_id = auth.uid()
    OR invited_identity IN (
      SELECT email FROM profiles WHERE id = auth.uid()
      UNION
      SELECT phone FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_access.collection_id
        AND collections.owner_id = auth.uid()
    )
  );

-- Insert: Only collection owners can grant access
CREATE POLICY "Collection owners can grant access"
  ON collection_access FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND granted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_access.collection_id
        AND collections.owner_id = auth.uid()
    )
  );

-- Update: Only collection owners can update access (e.g., change level or expiration)
CREATE POLICY "Collection owners can update access"
  ON collection_access FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_access.collection_id
        AND collections.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_access.collection_id
        AND collections.owner_id = auth.uid()
    )
  );

-- Delete: Only collection owners can revoke access
CREATE POLICY "Collection owners can revoke access"
  ON collection_access FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_access.collection_id
        AND collections.owner_id = auth.uid()
    )
  );

COMMENT ON POLICY "Collection owners and invitees can view access" ON collection_access IS 'Users can see invitations they granted, received, or where they are the collection owner.';
COMMENT ON POLICY "Collection owners can grant access" ON collection_access IS 'Only collection owners can invite others to their collections.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Configure Supabase Auth providers (Google OAuth)
-- 2. Update application code to handle auth state
-- 3. Test RLS policies with multiple user accounts
-- 4. Implement collection sharing UI
-- ============================================================================
