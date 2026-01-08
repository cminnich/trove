-- ============================================================================
-- MIGRATION 005: Fix RLS Infinite Recursion with Security Definer Functions
-- ============================================================================
-- Problem: Collections policy checks collection_access, which creates
-- infinite recursion when collection_access also needs to check collections.
--
-- Solution: Use SECURITY DEFINER functions that bypass RLS to safely check
-- permissions without circular dependencies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Drop problematic policies
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Collections are readable based on visibility and access" ON collections;
DROP POLICY IF EXISTS "Collection items inherit collection read permissions" ON collection_items;
DROP POLICY IF EXISTS "Collection owners and editors can manage items" ON collection_items;

-- ----------------------------------------------------------------------------
-- STEP 2: Create security definer function to check collection read access
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION user_can_read_collection(
  collection_id uuid,
  user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to prevent recursion
SET search_path = public
AS $$
DECLARE
  collection_visibility text;
  collection_owner_id uuid;
  has_explicit_access boolean;
  user_email text;
  user_phone text;
BEGIN
  -- Return false if no user
  IF user_id IS NULL THEN
    -- Check if collection is public for anonymous access
    SELECT visibility INTO collection_visibility
    FROM collections
    WHERE id = collection_id;

    RETURN collection_visibility = 'public';
  END IF;

  -- Get collection details (bypasses RLS due to SECURITY DEFINER)
  SELECT visibility, owner_id
  INTO collection_visibility, collection_owner_id
  FROM collections
  WHERE id = collection_id;

  -- If collection doesn't exist, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check 1: Public collections are readable by everyone
  IF collection_visibility = 'public' THEN
    RETURN true;
  END IF;

  -- Check 2: Owner can always read
  IF collection_owner_id = user_id THEN
    RETURN true;
  END IF;

  -- Check 3: User has explicit shared access
  -- Get user's email and phone for identity matching
  SELECT email, phone INTO user_email, user_phone
  FROM profiles
  WHERE id = user_id;

  SELECT EXISTS (
    SELECT 1
    FROM collection_access
    WHERE collection_access.collection_id = user_can_read_collection.collection_id
      AND (
        collection_access.user_id = user_id
        OR collection_access.invited_identity = user_email
        OR collection_access.invited_identity = user_phone
      )
      AND (collection_access.expires_at IS NULL OR collection_access.expires_at > now())
  ) INTO has_explicit_access;

  RETURN has_explicit_access;
END;
$$;

COMMENT ON FUNCTION user_can_read_collection IS 'Security definer function to check if user can read a collection. Bypasses RLS to prevent infinite recursion.';

-- ----------------------------------------------------------------------------
-- STEP 3: Create security definer function to check collection write access
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION user_can_write_collection(
  collection_id uuid,
  user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  collection_owner_id uuid;
  is_editor boolean;
  user_email text;
  user_phone text;
BEGIN
  -- Return false if no user
  IF user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get collection owner
  SELECT owner_id INTO collection_owner_id
  FROM collections
  WHERE id = collection_id;

  -- If collection doesn't exist, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check 1: Owner can always write
  IF collection_owner_id = user_id THEN
    RETURN true;
  END IF;

  -- Check 2: User has editor access
  SELECT email, phone INTO user_email, user_phone
  FROM profiles
  WHERE id = user_id;

  SELECT EXISTS (
    SELECT 1
    FROM collection_access
    WHERE collection_access.collection_id = user_can_write_collection.collection_id
      AND collection_access.access_level = 'editor'
      AND (
        collection_access.user_id = user_id
        OR collection_access.invited_identity = user_email
        OR collection_access.invited_identity = user_phone
      )
      AND (collection_access.expires_at IS NULL OR collection_access.expires_at > now())
  ) INTO is_editor;

  RETURN is_editor;
END;
$$;

COMMENT ON FUNCTION user_can_write_collection IS 'Security definer function to check if user can write to a collection (owner or editor).';

-- ----------------------------------------------------------------------------
-- STEP 4: Create new RLS policies using security definer functions
-- ----------------------------------------------------------------------------

-- Collections: Read using security definer function
CREATE POLICY "Collections readable via access check"
  ON collections FOR SELECT
  USING (user_can_read_collection(id, auth.uid()));

-- Collection Items: Read access inherits from collection
CREATE POLICY "Collection items readable if collection is readable"
  ON collection_items FOR SELECT
  USING (user_can_read_collection(collection_id, auth.uid()));

-- Collection Items: Write access (owner or editor)
CREATE POLICY "Collection items writable by collection editors"
  ON collection_items FOR ALL
  USING (user_can_write_collection(collection_id, auth.uid()))
  WITH CHECK (user_can_write_collection(collection_id, auth.uid()));

-- ----------------------------------------------------------------------------
-- STEP 5: Fix collection_access policy (simpler, no recursion)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Collection owners and invitees can view access" ON collection_access;

CREATE POLICY "Users can view access grants they created or received"
  ON collection_access FOR SELECT
  USING (
    -- User is the one who granted access
    granted_by = auth.uid()
    -- OR user has claimed this access
    OR user_id = auth.uid()
    -- OR invitation matches user's email/phone
    OR invited_identity IN (
      SELECT email FROM profiles WHERE id = auth.uid()
      UNION
      SELECT phone FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The RLS policies now use SECURITY DEFINER functions to safely check
-- permissions without infinite recursion.
--
-- How it works:
-- 1. Collections policy calls user_can_read_collection()
-- 2. That function runs with SECURITY DEFINER, bypassing RLS
-- 3. It safely queries collection_access without triggering policies
-- 4. No circular dependency, no infinite recursion
--
-- This is the standard pattern for complex RLS scenarios in Postgres.
-- ============================================================================
