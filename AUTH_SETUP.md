# Authentication Setup Guide

This guide walks through setting up Google OAuth authentication and multi-user support for Trove.

## Prerequisites

- Supabase project created
- Google Cloud Console account
- Environment variables already configured (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`)

---

## Step 1: Run Database Migration

### 1.1 Connect to Supabase

Navigate to your Supabase project dashboard and go to the SQL Editor.

### 1.2 Run Migration 004

Copy the contents of `supabase/migrations/004_auth_and_sharing.sql` and execute it in the SQL Editor.

**What this does**:
- Drops old `users` table
- Creates `profiles` table
- Creates `collection_access` table for sharing
- Updates `collections` table with `owner_id` and `visibility`
- Sets up RLS policies (NOTE: has a bug, fixed in 005)
- Creates auth triggers for profile sync and identity claiming

### 1.3 Run Migration 005 (Fix RLS Recursion)

**IMPORTANT**: Immediately run migration 005 to fix an infinite recursion bug in the RLS policies.

Copy the contents of `supabase/migrations/005_fix_rls_with_security_definer.sql` and execute it.

**What this does**:
- Fixes infinite recursion in collections RLS policy
- Implements proper SECURITY DEFINER functions for permission checks
- Creates `user_can_read_collection()` and `user_can_write_collection()` functions
- Updates policies to use these functions instead of direct queries

### 1.4 Verify Migrations

Run this query to verify tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see: `collection_access`, `collection_items`, `collections`, `items`, `profiles`

---

## Step 2: Configure Google OAuth

### 2.1 Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API** (required for OAuth)
4. Navigate to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client ID**
6. Configure the consent screen if prompted:
   - Application type: External
   - App name: Trove
   - User support email: your email
   - Developer contact: your email
7. Create OAuth client ID:
   - Application type: **Web application**
   - Name: Trove Auth
   - Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://YOUR_DOMAIN.com` (production)
   - Authorized redirect URIs:
     - `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`

8. Copy the **Client ID** and **Client Secret**

### 2.2 Configure in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication > Providers**
3. Find **Google** in the provider list
4. Toggle to **Enable**
5. Paste your **Client ID** and **Client Secret**
6. Click **Save**

### 2.3 Configure Redirect URLs

1. In Supabase Dashboard, go to **Authentication > URL Configuration**
2. Set **Site URL**: `http://localhost:3000` (development) or `https://YOUR_DOMAIN.com` (production)
3. Add **Redirect URLs**:
   - `http://localhost:3000/add` (development)
   - `https://YOUR_DOMAIN.com/add` (production)
4. Click **Save**

---

## Step 3: Update Existing Collections (Data Migration)

If you have existing collections in your database, they need to be assigned to an owner.

### Option A: Claim All Orphaned Collections for First User

Run this SQL after creating your first user account (sign in with Google once):

```sql
-- Get the first user's ID
SELECT id, email FROM auth.users LIMIT 1;

-- Update all orphaned collections to this user
UPDATE collections
SET owner_id = 'PASTE_USER_ID_HERE'
WHERE owner_id IS NULL;
```

### Option B: Delete All Orphaned Collections (Fresh Start)

```sql
DELETE FROM collections WHERE owner_id IS NULL;
```

After this, new collections will automatically be assigned to the user who creates them.

---

## Step 4: Test Authentication Flow

### 4.1 Start Development Server

```bash
npm run dev
```

### 4.2 Test Sign-In Flow

1. Navigate to `http://localhost:3000/add`
2. You should see the "Sign in to Save" screen
3. Click "Sign in with Google"
4. Complete the Google OAuth flow
5. You should be redirected back to `/add`
6. Verify you're signed in (no longer seeing the sign-in screen)

### 4.3 Verify Profile Created

In Supabase Dashboard, go to **Table Editor > profiles**

You should see a new row with:
- `id`: Your user ID
- `email`: Your Google email
- `avatar_url`: Your Google profile picture URL

### 4.4 Test Session Persistence

1. Refresh the page
2. You should remain signed in (not see the sign-in screen again)
3. Close the browser tab
4. Open a new tab to `http://localhost:3000/add`
5. You should still be signed in

### 4.5 Test OAuth Redirect with URL Preservation

1. Sign out (open browser console and run: `await supabase.auth.signOut()`)
2. Navigate to `http://localhost:3000/add?url=https://example.com/product`
3. You should see the sign-in screen with "Ready to save: https://example.com/product"
4. Sign in with Google
5. After redirect, the URL parameter should be preserved
6. The extraction should auto-start

---

## Step 5: Test Row-Level Security (RLS)

### 5.1 Create Two Test Accounts

1. Sign in with your primary Google account (User A)
2. Create a private collection in Trove
3. Add some items to it
4. Sign out
5. Sign in with a different Google account (User B)
6. Try to access User A's collections via URL or API

### 5.2 Verify Data Isolation

**Expected behavior**:
- User B cannot see User A's private collections
- User B cannot see items in User A's collections
- User B can create their own collections without conflicts

**Test via SQL**:

```sql
-- Set session to User A
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "USER_A_ID_HERE"}';

-- Should only see User A's collections
SELECT * FROM collections;

-- Reset and set to User B
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "USER_B_ID_HERE"}';

-- Should only see User B's collections
SELECT * FROM collections;
```

### 5.3 Test Public Collections

1. Create a collection with `visibility = 'public'` (via SQL for now):

```sql
UPDATE collections
SET visibility = 'public'
WHERE id = 'COLLECTION_ID_HERE';
```

2. Sign out
3. Try to access the collection via URL (should be viewable even when logged out)

---

## Step 6: Test Collection Sharing

### 6.1 Grant Access to Another User

As User A, grant access to User B:

```sql
-- Insert sharing invitation (use User A's ID for granted_by)
INSERT INTO collection_access (
  collection_id,
  invited_identity,
  access_level,
  granted_by
) VALUES (
  'COLLECTION_ID_HERE',
  'userb@example.com', -- User B's email
  'viewer', -- or 'editor'
  'USER_A_ID_HERE'
);
```

### 6.2 Verify Pre-Signup Invitation

Check that the invitation is created:

```sql
SELECT * FROM collection_access WHERE invited_identity = 'userb@example.com';
```

You should see:
- `user_id`: NULL (not claimed yet)
- `claimed_at`: NULL

### 6.3 Test Identity Claiming

1. Sign up/sign in as User B with the email `userb@example.com`
2. The claiming trigger should automatically populate `user_id` and `claimed_at`
3. Verify:

```sql
SELECT * FROM collection_access WHERE invited_identity = 'userb@example.com';
```

You should now see:
- `user_id`: User B's ID (populated)
- `claimed_at`: Timestamp (populated)

### 6.4 Verify Shared Access

As User B, try to access User A's shared collection:

1. Query collections (should include shared collection):

```sql
-- As User B
SELECT * FROM collections WHERE id = 'SHARED_COLLECTION_ID';
```

2. Try to read items in the collection (should work):

```sql
SELECT * FROM collection_items WHERE collection_id = 'SHARED_COLLECTION_ID';
```

3. Test permission levels:
   - **Viewer**: Can read, cannot write
   - **Editor**: Can read and write

---

## Step 7: Deploy to Production

### 7.1 Run Migration on Production Database

1. Connect to production Supabase project
2. Run `supabase/migrations/004_auth_and_sharing.sql` via SQL Editor

### 7.2 Configure Google OAuth for Production

1. In Google Cloud Console, add production redirect URI:
   - `https://YOUR_PRODUCTION_SUPABASE_REF.supabase.co/auth/v1/callback`
2. In Supabase Dashboard (production), configure Google provider with same Client ID/Secret
3. Set production Site URL and Redirect URLs

### 7.3 Update Environment Variables

Ensure production environment (e.g., Vercel) has:
- `NEXT_PUBLIC_SUPABASE_URL` (production Supabase URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (production anon key)
- `SUPABASE_SECRET_KEY` (production service role key)

### 7.4 Deploy Application

```bash
# Example with Vercel
vercel --prod
```

### 7.5 Test Production Auth

1. Navigate to production URL + `/add`
2. Sign in with Google
3. Verify profile created
4. Test item capture flow

---

## Troubleshooting

### Issue: "Sign in with Google" redirects to error page

**Cause**: Redirect URI mismatch

**Fix**:
1. Check that the redirect URI in Google Cloud Console matches exactly:
   - `https://YOUR_SUPABASE_REF.supabase.co/auth/v1/callback`
2. Ensure the Supabase URL in env vars is correct
3. Clear browser cache and cookies

### Issue: Profile not created after sign-in

**Cause**: Auth trigger not firing or missing permissions

**Fix**:
1. Verify trigger exists:

```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

2. Check trigger function permissions:

```sql
\df+ handle_new_user
```

Should show `SECURITY DEFINER`

3. Manually test trigger:

```sql
-- Simulate new user creation
INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'test@example.com');

-- Check if profile was created
SELECT * FROM profiles WHERE email = 'test@example.com';
```

### Issue: RLS policies blocking legitimate access

**Cause**: Policy syntax error or missing user context

**Fix**:
1. Test policies with explicit user ID:

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "YOUR_USER_ID"}';

-- Try the query that's failing
SELECT * FROM collections;
```

2. Check Supabase logs for RLS errors (Dashboard > Logs > Postgres Logs)

3. Temporarily disable RLS for debugging:

```sql
ALTER TABLE collections DISABLE ROW LEVEL SECURITY;
```

**Remember to re-enable after debugging!**

### Issue: OAuth redirect loses URL parameter

**Cause**: `redirectTo` not properly set

**Fix**:
1. Verify `SignInView` component is using:

```typescript
const currentUrl = window.location.href // Includes query params
```

2. Check browser console for any errors during redirect

3. Test with simple URL first: `http://localhost:3000/add?url=https://example.com`

---

## Security Checklist

Before going to production, ensure:

- [ ] RLS is enabled on all tables
- [ ] All RLS policies are tested with multiple user accounts
- [ ] Google OAuth credentials are stored securely (not in code)
- [ ] Production redirect URIs are HTTPS only
- [ ] Supabase service role key (`SUPABASE_SECRET_KEY`) is never exposed to client
- [ ] Rate limiting is configured in Supabase (Auth > Rate Limits)
- [ ] Email confirmations are enabled if using email/password auth (future)
- [ ] Auth logs are monitored for suspicious activity

---

## Next Steps

After authentication is working:

1. **Implement Sharing UI**: Add buttons to share collections with other users
2. **Profile Management**: Create `/settings` page for users to manage their profile
3. **Shared Collections View**: Add "Shared with me" section
4. **Access Level Controls**: UI for changing viewer/editor permissions
5. **Temporary Sharing**: Implement `expires_at` functionality
6. **SMS Authentication**: Add phone number auth as alternative to Google

---

## Reference Links

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [AUTH_SHARING.md](./AUTH_SHARING.md) - Detailed architecture and future roadmap
