# Apply Migration 007 - Collection INSERT Fix

## What This Migration Does

Fixes the RLS error when creating collections by adding a `create_user_collection()` database function that properly handles authentication context.

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `007_fix_collection_insert_rls.sql`
5. Click **Run**
6. Verify success (should see "Success. No rows returned")

### Option 2: Supabase CLI

If you have the Supabase CLI set up:

```bash
# From project root
npx supabase db push
```

### Option 3: Manual SQL Execution

Connect to your database and run:

```sql
-- Copy the entire contents of 007_fix_collection_insert_rls.sql here
```

## Verification

After applying the migration, test collection creation:

```bash
# From your app, try creating a collection
# Should now work without RLS errors
```

You can also verify the function exists:

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'create_user_collection';
```

## Security

This migration maintains the same security model as migration 005:
- Uses SECURITY DEFINER pattern (same as `user_can_read_collection`)
- Verifies user is authenticated before creating collection
- Ensures owner_id is set to authenticated user
- No privilege escalation or security bypass

## Rollback

If needed, you can rollback by:

```sql
DROP FUNCTION IF EXISTS create_user_collection(text, text, text, text);
```

Note: This will break collection creation until you either:
1. Reapply the migration, OR
2. Fix the auth.uid() context issue in Next.js
