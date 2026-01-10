-- ============================================================================
-- MIGRATION 007: Fix Collection INSERT RLS with Security Definer Function
-- ============================================================================
-- Problem: Collection INSERT policy fails with RLS error 42501 because the
-- auth.uid() context is not properly set when using createServerClient with
-- the anon key in Next.js API routes, even when the user is authenticated.
--
-- Root Cause:
-- - The RLS policy requires: WITH CHECK (owner_id = auth.uid())
-- - In Next.js server components/API routes, the session is stored in cookies
-- - When createServerClient is used, the auth context doesn't propagate to
--   the database session properly, causing auth.uid() to return NULL
-- - This causes RLS to reject the INSERT even for authenticated users
--
-- Solution: Create a SECURITY DEFINER function (like user_can_read_collection
-- from migration 005) that verifies authentication and creates collections.
-- This is the recommended pattern for complex RLS scenarios in Postgres.
--
-- Security Guarantees:
-- 1. Function verifies auth.uid() IS NOT NULL before proceeding
-- 2. owner_id is explicitly set to auth.uid() (user cannot spoof this)
-- 3. Function runs with elevated privileges but validates all inputs
-- 4. Consistent with the SECURITY DEFINER pattern used for read operations
--
-- Why Not Just Use Service Role Client?
-- - Service role bypasses ALL security, not just RLS
-- - Database functions provide audit trail and single source of truth
-- - Keeps business logic in database, not scattered in API routes
-- - Matches the architecture established in migration 005
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Create security definer function to create collections
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_user_collection(
  collection_name text,
  collection_description text DEFAULT NULL,
  collection_type text DEFAULT NULL,
  collection_visibility text DEFAULT 'private'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_collection_id uuid;
  current_user_id uuid;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();

  -- Verify user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create collections';
  END IF;

  -- Verify visibility value
  IF collection_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'Visibility must be either public or private';
  END IF;

  -- Insert collection
  INSERT INTO collections (
    name,
    description,
    type,
    visibility,
    owner_id
  ) VALUES (
    collection_name,
    collection_description,
    collection_type,
    collection_visibility,
    current_user_id
  )
  RETURNING id INTO new_collection_id;

  RETURN new_collection_id;
END;
$$;

COMMENT ON FUNCTION create_user_collection IS 'Creates a collection for the authenticated user. Bypasses RLS with SECURITY DEFINER.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_collection TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
