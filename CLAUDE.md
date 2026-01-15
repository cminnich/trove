# Claude Code Project Instructions

## Pre-Deployment Verification (CRITICAL)

Before considering any code change complete, **always run**:

```bash
npm run build
```

This catches TypeScript errors that the IDE/watch mode misses due to incremental compilation. Vercel runs a clean build on every deployment, which is stricter than local development.

**Why this matters:** Local TypeScript checking uses cached `.d.ts` files and incremental compilation. The production build does a fresh type resolution that catches issues like `never` type inference failures.

---

## Supabase TypeScript Patterns

### The Problem

Supabase's TypeScript types sometimes fail to infer return types from query chains, resulting in `never` type errors. This happens when:

1. Selecting specific columns: `.select("column_name")`
2. Insert/update operations through wrapper functions
3. Complex query chains

These errors often only appear in production builds, not in IDE type checking.

### Pattern 1: Single-Column Select Queries

**Bad** (compiles locally, fails in production):
```typescript
const { data: profile } = await client
  .from("profiles")
  .select("default_visibility")
  .single();

// TypeScript infers `profile` as `never`
const visibility = profile?.default_visibility; // Error!
```

**Good** (explicit type annotation):
```typescript
const { data: profile } = await client
  .from("profiles")
  .select("default_visibility")
  .single();

// Explicitly define the expected shape
type ProfileVisibility = Pick<Database["public"]["Tables"]["profiles"]["Row"], "default_visibility">;
const visibility = (profile as ProfileVisibility | null)?.default_visibility || 'public';
```

### Pattern 2: Insert/Update Operations

**Bad** (type inference fails):
```typescript
const { error } = await client
  .from("profiles")
  .insert({
    id: user.id,
    email: user.email,
  });
```

**Good** (explicit types):
```typescript
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

const insertData: ProfileInsert = {
  id: user.id,
  email: user.email,
};

const { error } = await (client as any)
  .from("profiles")
  .insert(insertData);
```

### Pattern 3: Generic Select with Full Row

When selecting all columns or multiple columns, prefer using the full Row type:

```typescript
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const { data } = await client
  .from("profiles")
  .select("*")
  .eq("id", userId)
  .single();

// Cast if needed
const profile = data as Profile | null;
```

---

## Available Type Definitions

Import database types from:
```typescript
import type { Database } from "@/types/database";
```

Common type patterns:
```typescript
// Full row type
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Insert type (optional fields)
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

// Update type (all fields optional)
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

// Pick specific columns
type ProfileVisibility = Pick<Profile, "default_visibility">;
```

---

## Client Usage

### Server Components / API Routes

```typescript
import { getAuthenticatedServerClient } from "@/lib/supabase-server";

const { client, user, error } = await getAuthenticatedServerClient();
```

### Service Role (Privileged Operations)

```typescript
import { getServiceRoleClient } from "@/lib/supabase-server";

const client = getServiceRoleClient(); // Bypasses RLS
```

### Client Components

```typescript
import { createClient } from "@/lib/supabase-client";

const supabase = createClient();
```

---

## Verification Checklist

Before marking work complete:

1. [ ] Run `npm run build` - must pass with no errors
2. [ ] Run `npm run type-check` - for quick type verification
3. [ ] Test the actual functionality (API endpoints, UI interactions)

---

## Common Error Messages and Fixes

### "Property 'X' does not exist on type 'never'"

**Cause:** TypeScript can't infer the return type from Supabase query.
**Fix:** Add explicit type annotation (see Pattern 1 above).

### "Argument of type 'X' is not assignable to parameter of type 'never'"

**Cause:** Insert/update operation type inference failure.
**Fix:** Define typed data object and cast client (see Pattern 2 above).

### "No overload matches this call"

**Cause:** Complex query chain losing type information.
**Fix:** Break into explicit typed steps or use `as any` on the client for that operation.
