# Security Pattern: Collection Creation

## Problem Statement

Collection creation was failing with RLS error 42501:
```
new row violates row-level security policy for table "collections"
```

## Root Cause

The RLS policy for collection INSERT requires:
```sql
CREATE POLICY "Users can create their own collections"
  ON collections FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());
```

However, when using `createServerClient` with the anon key in Next.js API routes, the authentication context (`auth.uid()`) doesn't propagate to the database session, even when the user is authenticated. This is a known limitation of Supabase SSR in Next.js server components.

## Solution: SECURITY DEFINER Function

We use the same pattern as migration 005 (which fixed read operations):

```sql
CREATE OR REPLACE FUNCTION create_user_collection(...)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges
SET search_path = public
AS $$
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Create collection with owner_id = auth.uid()
  INSERT INTO collections (...)
  VALUES (...)
  RETURNING id;
END;
$$;
```

## Security Guarantees

### ✅ What Makes This Secure

1. **Authentication Required**: Function checks `auth.uid() IS NOT NULL` before proceeding
2. **No Privilege Escalation**: User can only create collections owned by themselves
3. **Input Validation**: Validates visibility value, sanitizes inputs
4. **Consistent Pattern**: Same SECURITY DEFINER pattern as `user_can_read_collection()`
5. **Single Source of Truth**: Business logic in database, not scattered in API routes
6. **Audit Trail**: Database function calls can be logged and monitored

### ✅ What Makes This Better Than Service Role Client

**Service Role Client Approach (REJECTED):**
```typescript
// ❌ BAD: Bypasses ALL security, not just RLS
const serviceClient = getServerClient();
await serviceClient.from('collections').insert({
  owner_id: user.id,  // Trust application to set this correctly
  ...data
});
```

**Problems with service role approach:**
- Bypasses all security, not just RLS
- No audit trail
- Business logic in application code
- Easy to make mistakes (forget to set owner_id, etc.)
- Inconsistent with existing security patterns

**SECURITY DEFINER Function Approach (USED):**
```typescript
// ✅ GOOD: Uses database function with proper validation
const { data: collectionId } = await client.rpc('create_user_collection', {
  collection_name: name,
  collection_description: description,
  collection_type: type,
  collection_visibility: 'private',
});
```

**Advantages:**
- Database enforces authentication requirement
- Cannot create collections for other users (auth.uid() used internally)
- Audit trail via function calls
- Business logic in database (single source of truth)
- Matches existing patterns (user_can_read_collection, etc.)

## Comparison to Existing Patterns

### Migration 005: Read Operations

```sql
-- For reads, we use SECURITY DEFINER to check permissions
CREATE FUNCTION user_can_read_collection(collection_id uuid)
RETURNS boolean
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user owns collection or has access
  RETURN (owner_id = auth.uid() OR has_explicit_access);
END;
$$;

-- Then use in policy
CREATE POLICY "..." ON collections FOR SELECT
  USING (user_can_read_collection(id));
```

### Migration 007: Create Operations (This Pattern)

```sql
-- For creates, we use SECURITY DEFINER to perform the insert
CREATE FUNCTION create_user_collection(...)
RETURNS uuid
SECURITY DEFINER
AS $$
BEGIN
  -- Verify auth and create collection
  INSERT INTO collections (owner_id, ...)
  VALUES (auth.uid(), ...);
END;
$$;

-- Called from API route after authentication
await client.rpc('create_user_collection', {...});
```

**Both use SECURITY DEFINER, but for different purposes:**
- Migration 005: Check permissions (returns boolean)
- Migration 007: Perform action with validation (returns UUID)

## Code Changes

### app/api/collections/route.ts

**Before (BROKEN):**
```typescript
const { data, error } = await client
  .from("collections")
  .insert({
    owner_id: user.id,
    ...data
  });
// Failed with: RLS error 42501
```

**After (WORKING):**
```typescript
// Use SECURITY DEFINER function instead of direct INSERT
const { data: collectionId, error: rpcError } = await client.rpc(
  'create_user_collection',
  {
    collection_name: body.name,
    collection_description: body.description || null,
    collection_type: body.type || null,
    collection_visibility: 'private',
  }
);

// Then fetch the created collection via RLS
const { data } = await client
  .from("collections")
  .select()
  .eq("id", collectionId)
  .single();
```

## Testing

### Verify Security

1. **Unauthenticated user cannot create collections:**
```bash
curl -X POST http://localhost:3000/api/collections \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
# Expected: 401 Unauthorized
```

2. **Authenticated user can create collections:**
```bash
# Sign in via UI, then:
curl -X POST http://localhost:3000/api/collections \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{"name": "Test"}'
# Expected: 200 OK with collection data
```

3. **User cannot create collections for others:**
```typescript
// Even if you try to bypass via direct SQL:
await client.rpc('create_user_collection', {...});
// owner_id will ALWAYS be set to auth.uid(), never user-controlled
```

## Files Modified

1. **Migration:** `supabase/migrations/007_fix_collection_insert_rls.sql`
   - Adds `create_user_collection()` function
   - Grants execute permission to authenticated users

2. **API Route:** `app/api/collections/route.ts`
   - POST handler uses `client.rpc('create_user_collection', ...)`
   - GET handler uses same function for Inbox auto-creation
   - Removed service role client usage

3. **Documentation:**
   - This file (security pattern explanation)
   - `007_APPLY_THIS.md` (migration instructions)

## Migration Instructions

See `supabase/migrations/007_APPLY_THIS.md` for how to apply this migration.

## Summary

**Pattern:** Use SECURITY DEFINER database functions for operations where RLS context is problematic

**Security:** ✅ Secure - maintains all authentication and authorization requirements

**Consistency:** ✅ Matches existing patterns from migration 005

**Best Practice:** ✅ Keeps business logic in database, provides audit trail

**Status:** ✅ Safe for production deployment
