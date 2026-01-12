# Test Setup Guide

This guide explains how to set up test credentials for Playwright and automated testing.

## Email/Password Authentication Setup

The app now supports both Google OAuth and email/password authentication for easier testing.

### 1. Enable Email/Password Provider in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Email** provider
4. Enable the toggle
5. Configure settings:
   - **Enable** "email"
   - **Confirm email**: Disable for testing (optional, but makes testing easier)
   - **Secure email change**: Enable (recommended)
   - **Email OTP length**: 6 digits (default)
6. Click **Save**

### 2. Test User (Already Created)

**A test user has already been created for this project:**

```
Email: test@example.com
Password: trove123
```

This user is ready to use for Playwright tests and manual testing. No additional setup required.

#### To Create Additional Test Users

##### Option A: Via Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter test credentials
4. **Auto Confirm User**: ✅ Enable (important for testing)
5. Click **Create user**

##### Option B: Via Login Page

1. Navigate to `http://localhost:3000/auth/login`
2. Click "Don't have an account? Sign up"
3. Enter email and password
4. Click **Create Account**

**Note**: If email confirmation is enabled, you'll need to check your email and click the confirmation link. For testing, it's recommended to disable email confirmation in Supabase settings.

## Playwright Test Setup

### Environment Variables

Create a `.env.test` file in the project root (copy values from your `.env.local`):

```env
# Test user credentials (existing test user)
TEST_EMAIL=test@example.com
TEST_PASSWORD=trove123

# Supabase credentials (copy from .env.local)
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SECRET_KEY=<your_secret_key>
```

**Quick setup:**
```bash
# Copy your existing environment file
cp .env.local .env.test

# Then add these lines to .env.test:
echo "" >> .env.test
echo "# Test credentials" >> .env.test
echo "TEST_EMAIL=test@example.com" >> .env.test
echo "TEST_PASSWORD=trove123" >> .env.test
```

### Example Playwright Test

```typescript
import { test, expect } from '@playwright/test'

test('user can sign in with email/password', async ({ page }) => {
  // Navigate to login page
  await page.goto('http://localhost:3000/auth/login')

  // Fill in credentials
  await page.fill('input[type="email"]', process.env.TEST_EMAIL!)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD!)

  // Click sign in
  await page.click('button[type="submit"]')

  // Wait for redirect to collections page
  await page.waitForURL('/collections')

  // Verify user is logged in
  await expect(page.locator('h1')).toContainText('Collections')
})

test('add items to collection flow', async ({ page }) => {
  // Login first
  await page.goto('http://localhost:3000/auth/login')
  await page.fill('input[type="email"]', process.env.TEST_EMAIL!)
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD!)
  await page.click('button[type="submit"]')
  await page.waitForURL('/collections')

  // Navigate to a collection
  await page.click('a[href^="/collections/"]')

  // Open add items drawer
  await page.click('button:has-text("Add Item")')

  // Verify drawer is open and shows items
  await expect(page.locator('text=Add Items to Collection')).toBeVisible()
})
```

## Automated Test User Creation Script

For CI/CD pipelines or batch test setup, you can create test users via the Supabase Admin API:

```typescript
// scripts/create-test-user.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function createTestUser() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test2@example.com', // Use different email if test@example.com exists
    password: 'trove123',
    email_confirm: true, // Auto-confirm for testing
  })

  if (error) {
    console.error('Error creating test user:', error)
    process.exit(1)
  }

  console.log('Test user created:', data.user.email)
}

createTestUser()
```

Run with:
```bash
npx tsx scripts/create-test-user.ts
```

## Testing Different Auth Flows

### Sign Up Flow
1. Navigate to `/auth/login`
2. Click "Don't have an account? Sign up"
3. Enter new credentials
4. Verify email if confirmation is enabled
5. User should be redirected to collections page

### Sign In Flow
1. Navigate to `/auth/login`
2. Enter existing credentials
3. User should be redirected to collections page

### Google OAuth Flow
1. Click "Google" button on login page
2. Follow Google OAuth flow (requires real Google account)
3. User redirected back and authenticated

### Protected Route Access
1. Navigate to `/collections` without being logged in
2. Should be redirected to `/auth/login?next=/collections`
3. After login, should be redirected back to `/collections`

### Add Item Flow with URL Parameter
1. Navigate to `/add?url=https://example.com/product`
2. Should be redirected to `/auth/login?next=/add?url=...`
3. After login, should be redirected back to `/add` with URL preserved

## Cleanup Test Data

To clean up test data after running tests:

```sql
-- Delete test user's collections and items
DELETE FROM collection_items WHERE collection_id IN (
  SELECT id FROM collections WHERE user_id = (
    SELECT id FROM profiles WHERE email = 'test@example.com'
  )
);

DELETE FROM collections WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'test@example.com'
);

-- Delete test user profile
DELETE FROM profiles WHERE email = 'test@example.com';

-- Delete test user from auth.users (cascade deletes profile due to trigger)
DELETE FROM auth.users WHERE email = 'test@example.com';
```

Or via Supabase dashboard:
1. Go to **Authentication** → **Users**
2. Find test user
3. Click **...** → **Delete user**

## Troubleshooting

### "Email not confirmed" Error
- Disable email confirmation in Supabase settings: **Authentication** → **Providers** → **Email** → **Confirm email** = OFF
- Or manually confirm user in dashboard: **Authentication** → **Users** → Find user → **...** → **Confirm email**

### "Invalid login credentials" Error
- Verify test user exists in Supabase dashboard
- Check that password meets minimum requirements (6 characters)
- Ensure user's email is confirmed (if confirmation is enabled)

### Page Not Redirecting After Login
- Check browser console for errors
- Verify `next` parameter is properly URL-encoded
- Check middleware is properly setting auth cookies

### "Failed to fetch collections" Error
- Verify RLS policies allow authenticated users to read their own collections
- Check user has a profile record (should be auto-created by trigger)
- Verify Supabase environment variables are correct

## Security Notes

- **Never commit test credentials to git**
- Use `.env.test` and add it to `.gitignore`
- For production, use different test users and rotate credentials regularly
- Disable email confirmation only in development/test environments
- Consider using separate Supabase projects for testing vs production
