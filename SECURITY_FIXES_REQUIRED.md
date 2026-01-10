# 🚨 CRITICAL SECURITY FIXES REQUIRED

## Overview

This document outlines critical security vulnerabilities discovered in the Trove API and provides step-by-step fixes.

---

## Vulnerability Summary

**Severity:** CRITICAL
**Impact:** Complete authorization bypass - any user can access/modify/delete any other user's data
**Root Cause:** API routes use service role key (bypasses RLS) without application-level authorization checks

---

## Affected Endpoints

### Critical (Immediate Fix Required)

- ❌ `GET /api/collections/[id]` - Anyone can read any collection
- ❌ `PATCH /api/collections/[id]` - Anyone can modify any collection
- ❌ `DELETE /api/collections/[id]` - Anyone can delete any collection
- ❌ `GET /api/collections/[id]/items` - Anyone can read items from any collection
- ❌ `POST /api/collections/[id]/items` - Anyone can add items to any collection
- ❌ `DELETE /api/collections/[id]/items/[itemId]` - Anyone can remove items from any collection
- ❌ `PATCH /api/collections/[id]/items/reorder` - Anyone can reorder any collection's items

### Moderate (Review Required)

- ⚠️ `GET /api/items/[id]` - Items table may be intentionally public (verify)
- ⚠️ `GET /api/categories` - Categories may be shared (verify)
- ⚠️ `GET /api/tags` - Tags may be shared (verify)

---

## Fix Strategy

### Option 1: Use Authenticated Client (Recommended)

**Pros:**
- RLS policies automatically enforce authorization
- No manual ownership checks needed
- Database-level security
- Prevents SQL injection in authorization logic

**Cons:**
- Slightly more complex for some queries
- May need to use service client for specific aggregation queries

**Implementation:**

```typescript
// BEFORE (INSECURE):
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServerClient(); // ← BYPASSES RLS!

  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ success: true, data });
}

// AFTER (SECURE):
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Get authenticated user
  const { client, user, error: authError } = await getAuthenticatedServerClient();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Query using authenticated client - RLS automatically enforces ownership
  const { data, error } = await client
    .from("collections")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    // Will return 404 if user doesn't have access
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.code === "PGRST116" ? 404 : 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
```

---

### Option 2: Manual Authorization Checks (Not Recommended)

If you must use the service role client, you MUST manually validate ownership:

```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Get authenticated user
  const { client: authClient, user, error: authError } = await getAuthenticatedServerClient();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Use service client if needed (e.g., for performance)
  const supabase = getServerClient();

  // 3. Fetch the collection
  const { data: collection, error } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 4. CRITICAL: Manually check ownership OR use RLS function
  const canAccess = await supabase.rpc('user_can_read_collection', {
    collection_id: id,
    user_id: user.id
  });

  if (!canAccess.data) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: collection });
}
```

**Why this is worse:**
- Easy to forget authorization checks
- Manual logic can have bugs
- Doesn't leverage database security
- More code to maintain

---

## Step-by-Step Fix Plan

### Phase 1: Immediate Security Patches (Priority 1)

#### 1.1 Fix Collection CRUD Endpoints

**File:** `app/api/collections/[id]/route.ts`

Replace all three handlers (GET, PATCH, DELETE) to use `getAuthenticatedServerClient()`:

```typescript
import { getAuthenticatedServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data, error } = await client
      .from("collections")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.code === "PGRST116" ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Repeat pattern for PATCH and DELETE
```

#### 1.2 Fix Collection Items Endpoints

**File:** `app/api/collections/[id]/items/route.ts`

Same pattern - replace `getServerClient()` with `getAuthenticatedServerClient()`.

#### 1.3 Fix Item Removal Endpoint

**File:** `app/api/collections/[id]/items/[itemId]/route.ts`

Add authentication and authorization checks.

---

### Phase 2: Hybrid Approach for Performance (Priority 2)

Some queries need the service client for performance (e.g., aggregations). Use this pattern:

```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Authenticate
  const { client, user, error: authError } = await getAuthenticatedServerClient();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Verify access using authenticated client
  const { data: collection, error: accessError } = await client
    .from("collections")
    .select("id") // Only fetch ID to verify access
    .eq("id", id)
    .single();

  if (accessError || !collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 3. Now safe to use service client for expensive queries
  const supabase = getServerClient();

  const { data: items } = await supabase
    .from("collection_items")
    .select(`
      *,
      items(*),
      (SELECT COUNT(*) FROM item_snapshots WHERE item_id = items.id) as snapshot_count
    `)
    .eq("collection_id", id);

  return NextResponse.json({ success: true, data: items });
}
```

---

### Phase 3: Security Testing (Priority 1)

#### 3.1 Create Test Script

**File:** `tests/security/authorization-test.ts`

```typescript
/**
 * Security Test: Verify authorization enforcement
 *
 * This test should FAIL with the current code.
 * After fixes, it should PASS.
 */

describe('Authorization Security Tests', () => {
  let userAToken: string;
  let userBToken: string;
  let userACollectionId: string;

  beforeAll(async () => {
    // Create two test users
    userAToken = await createTestUser('usera@test.com');
    userBToken = await createTestUser('userb@test.com');

    // User A creates a private collection
    userACollectionId = await createCollection(userAToken, {
      name: 'User A Private Collection',
      visibility: 'private'
    });
  });

  test('User B cannot read User A private collection', async () => {
    const response = await fetch(`/api/collections/${userACollectionId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });

    // Should be 404 or 403, NOT 200
    expect(response.status).not.toBe(200);
  });

  test('User B cannot update User A collection', async () => {
    const response = await fetch(`/api/collections/${userACollectionId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userBToken}` },
      body: JSON.stringify({ name: 'Hacked!' })
    });

    expect(response.status).not.toBe(200);
  });

  test('User B cannot delete User A collection', async () => {
    const response = await fetch(`/api/collections/${userACollectionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` }
    });

    expect(response.status).not.toBe(200);
  });

  test('Unauthenticated user cannot access private collection', async () => {
    const response = await fetch(`/api/collections/${userACollectionId}`);
    expect(response.status).toBe(401);
  });
});
```

#### 3.2 Run Manual Tests

```bash
# 1. Create two users in Supabase Dashboard
# 2. Sign in as User A, create a private collection
# 3. Copy the collection ID
# 4. Sign in as User B
# 5. Try to access User A's collection:

curl https://localhost:3000/api/collections/[USER_A_COLLECTION_ID]

# Should return 404 or 403, NOT the collection data
```

---

## Cookie Security Verification

While auditing, verify Supabase cookies have proper flags:

```typescript
// In middleware.ts or callback route, verify cookies are set with:
{
  httpOnly: true,  // Prevents XSS attacks
  secure: true,    // Only sent over HTTPS
  sameSite: 'lax', // Prevents CSRF attacks
  path: '/',
  maxAge: 60 * 60 * 24 * 7 // 1 week
}
```

Check in browser DevTools > Application > Cookies - should see these flags.

---

## Additional Security Hardening

### 1. Add Rate Limiting

```typescript
// lib/rate-limit.ts
import { NextRequest } from 'next/server';

const rateLimit = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(req: NextRequest, limit = 100, windowMs = 60000): boolean {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const bucket = rateLimit.get(ip);

  if (!bucket || now > bucket.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count++;
  return true;
}
```

### 2. Add Request Logging

```typescript
// lib/audit-log.ts
export async function logSecurityEvent(event: {
  type: 'unauthorized_access' | 'permission_denied' | 'rate_limit_exceeded';
  userId?: string;
  ip: string;
  path: string;
  details?: any;
}) {
  const supabase = getServerClient();

  await supabase
    .from('security_audit_log')
    .insert({
      event_type: event.type,
      user_id: event.userId,
      ip_address: event.ip,
      request_path: event.path,
      details: event.details,
      created_at: new Date().toISOString()
    });
}
```

### 3. Add CORS Configuration

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Only allow requests from your domain
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://yourapp.com',
    'http://localhost:3000'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}
```

---

## Deployment Checklist

Before deploying these fixes:

- [ ] Audit all API routes for `getServerClient()` usage
- [ ] Replace with `getAuthenticatedServerClient()` or add manual checks
- [ ] Test with multiple user accounts
- [ ] Run security test suite
- [ ] Verify cookie security flags
- [ ] Enable Supabase rate limiting
- [ ] Set up monitoring/alerting for failed auth attempts
- [ ] Review Supabase logs for suspicious activity
- [ ] Update API documentation with auth requirements

---

## Timeline

| Phase | Priority | Effort | Timeline |
|-------|----------|--------|----------|
| Phase 1: Critical Fixes | P0 | 4-6 hours | Immediate |
| Phase 3: Security Testing | P0 | 2-3 hours | Same day |
| Phase 2: Performance Optimization | P1 | 3-4 hours | Next sprint |
| Additional Hardening | P2 | 4-6 hours | Next sprint |

---

## Questions?

- Why not just use RLS everywhere? → You should! That's the recommendation.
- When is service client OK? → Background jobs, admin operations, after verifying access.
- Should I disable the service role key? → No, but audit its usage carefully.

---

## Contact

For questions about this security audit, contact the security team or create a GitHub issue.

**DO NOT deploy the current code to production until these fixes are implemented.**
