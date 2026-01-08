-- ============================================================================
-- MIGRATION 005: Fix Infinite Recursion in RLS Policies
-- ============================================================================
-- The collection_access query in the collections SELECT policy creates
-- infinite recursion. We need to simplify the policies.
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Collections are readable based on visibility and access" ON collections;
DROP POLICY IF EXISTS "Collection owners and invitees can view access" ON collection_access;

-- ----------------------------------------------------------------------------
-- STEP 1: Simpler Collections Read Policy (no collection_access join)
-- ----------------------------------------------------------------------------

-- For now, use a simpler policy: public collections OR owned by you
-- We'll handle shared access in application logic until we find a non-recursive solution
CREATE POLICY "Collections are readable if public or owned"
  ON collections FOR SELECT
  USING (
    visibility = 'public'
    OR owner_id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- STEP 2: Fix collection_access read policy (no collections join)
-- ----------------------------------------------------------------------------

-- Users can see access records where they are the invitee or granter
CREATE POLICY "Users can view their access grants"
  ON collection_access FOR SELECT
  USING (
    granted_by = auth.uid()
    OR user_id = auth.uid()
    OR invited_identity IN (
      SELECT email FROM profiles WHERE id = auth.uid()
      UNION
      SELECT phone FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The infinite recursion is fixed. Collections and collection_access policies
-- no longer reference each other.
--
-- Trade-off: Shared collections (via collection_access) won't be visible
-- in the collections list until we implement a better solution.
-- For now, handle sharing in application logic.
-- ============================================================================
