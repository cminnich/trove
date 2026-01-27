-- ============================================================================
-- MIGRATION 015: Allow Editors to Update Collection Metadata
-- ============================================================================
-- This migration adds an RLS policy that allows users with 'editor' access
-- to update collection metadata (name, description, type, visibility, etc.)
--
-- Previously, only the collection owner could update metadata. This enables
-- true collaboration where editors can help manage the collection.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Drop any existing update policy on collections (if any)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Collections updatable by owner" ON collections;
DROP POLICY IF EXISTS "Collections updatable by editors" ON collections;

-- ----------------------------------------------------------------------------
-- STEP 2: Create update policy using existing user_can_write_collection function
-- ----------------------------------------------------------------------------
-- The user_can_write_collection function already checks:
-- 1. If user is the collection owner
-- 2. If user has 'editor' access level in collection_access
--
-- This makes it perfect for enforcing UPDATE permissions.

CREATE POLICY "Collections updatable by owner or editor"
  ON collections FOR UPDATE
  USING (user_can_write_collection(id, auth.uid()))
  WITH CHECK (user_can_write_collection(id, auth.uid()));

-- ----------------------------------------------------------------------------
-- STEP 3: Add RLS policies for collection_access management
-- ----------------------------------------------------------------------------
-- Only collection owners should be able to manage who has access (INSERT/DELETE)
-- The SELECT policy already exists from migration 005

-- Allow owners to grant access
DROP POLICY IF EXISTS "Collection owners can grant access" ON collection_access;
CREATE POLICY "Collection owners can grant access"
  ON collection_access FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_access.collection_id
      AND collections.owner_id = auth.uid()
    )
  );

-- Allow owners to revoke access
DROP POLICY IF EXISTS "Collection owners can revoke access" ON collection_access;
CREATE POLICY "Collection owners can revoke access"
  ON collection_access FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_access.collection_id
      AND collections.owner_id = auth.uid()
    )
  );

-- Allow owners to update access (e.g., change access level)
DROP POLICY IF EXISTS "Collection owners can update access" ON collection_access;
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

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- 1. Added UPDATE policy on collections for owners and editors
-- 2. Added INSERT policy on collection_access for owners only
-- 3. Added DELETE policy on collection_access for owners only
-- 4. Added UPDATE policy on collection_access for owners only
--
-- This enables:
-- - Editors to update collection metadata (name, description, etc.)
-- - Owners to manage collaborator access (invite, revoke, change roles)
-- ============================================================================
