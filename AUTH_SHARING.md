# Auth & Sharing: Vision and Implementation Roadmap

## 1. Long-term Vision: Identity-Centric Sharing

Trove is built to transform personal collections into persistent context for AI agents. For this to work at scale, sharing and identity must be "dead simple" and flexible.

### Core Principles

* **Public-First Collections**: By default, collections are public (view-only). This enables frictionless sharing of knowledge graphs without requiring immediate login from the recipient.
* **Identity Merging**: Users may interact with Trove via Google (email) or SMS. The system must treat identities (email, phone number) as "claims" that can be merged into a single user profile.
* **Granular Permissions**: Sharing is a first-class citizen, supporting both permanent and temporary access (e.g., "Editor" access for a spouse vs. "Viewer" access for a family member during a birthday window).

---

## 2. Implementation Phases

### Phase A: The Auth Foundation (Multi-User Transition)

**Goal**: Transform from single-user to multi-user while preserving the "global librarian" architecture.

**Key Changes**:
* **Provider**: Implement **Google Sign-In** via Supabase Auth for the MVP.
* **Profile Sync**: Use a Postgres trigger to automatically sync `auth.users` to a `public.profiles` table upon signup.
* **Global "Librarian" Items**: The `items` table remains a global repository of objective facts. Multiple users saving the same URL link to the same `item_id`, while their personal context stays in the junction table.
* **Owner Field Migration**: Change `collections.user_id` to `collections.owner_id` (FK to `profiles.id`) for clarity.

**Schema Changes**:
```sql
-- Drop old users table, replace with profiles
DROP TABLE users CASCADE;

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  phone text UNIQUE,
  avatar_url text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Update collections to reference profiles
ALTER TABLE collections
  DROP COLUMN user_id,
  ADD COLUMN owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'private'));
```

**Auth Trigger**:
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

### Phase B: Access Control (RLS & Visibility)

**Goal**: Secure the database with Row-Level Security while maintaining public-first defaults.

**Important**: RLS policies that check related tables can create infinite recursion. We use **SECURITY DEFINER functions** to bypass RLS within permission checks, preventing circular dependencies.

**RLS Policies**:

**Items** (global librarian - read for all, write for authenticated):
```sql
-- Anyone can read items (they're objective facts)
CREATE POLICY "Items are publicly readable"
  ON items FOR SELECT
  USING (true);

-- Only authenticated users can create items
CREATE POLICY "Authenticated users can create items"
  ON items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
```

**Collections** (owner + shared access via security definer function):
```sql
-- Security definer function prevents infinite recursion
CREATE FUNCTION user_can_read_collection(collection_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to prevent recursion
AS $$
BEGIN
  -- Check 1: Public collection
  -- Check 2: User is owner
  -- Check 3: User has explicit access via collection_access
  -- (Full implementation in migration 005)
END;
$$;

-- Policy uses the function
CREATE POLICY "Collections readable via access check"
  ON collections FOR SELECT
  USING (user_can_read_collection(id, auth.uid()));

-- Only owners can insert/update/delete collections
CREATE POLICY "Users can manage their own collections"
  ON collections FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
```

**Collection Items** (inherit from parent collection):
```sql
-- Can read collection_items if you can read the parent collection
CREATE POLICY "Collection items inherit collection permissions"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND (
        collections.visibility = 'public'
        OR collections.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_access.collection_id = collections.id
          AND (
            collection_access.user_id = auth.uid()
            OR collection_access.invited_identity = (SELECT email FROM profiles WHERE id = auth.uid())
            OR collection_access.invited_identity = (SELECT phone FROM profiles WHERE id = auth.uid())
          )
          AND (collection_access.expires_at IS NULL OR collection_access.expires_at > now())
        )
      )
    )
  );

-- Can write collection_items if you're owner OR editor
CREATE POLICY "Collection owners and editors can manage items"
  ON collection_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND (
        collections.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_access.collection_id = collections.id
          AND collection_access.access_level = 'editor'
          AND (
            collection_access.user_id = auth.uid()
            OR collection_access.invited_identity = (SELECT email FROM profiles WHERE id = auth.uid())
            OR collection_access.invited_identity = (SELECT phone FROM profiles WHERE id = auth.uid())
          )
          AND (collection_access.expires_at IS NULL OR collection_access.expires_at > now())
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND (
        collections.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_access.collection_id = collections.id
          AND collection_access.access_level = 'editor'
          AND (
            collection_access.user_id = auth.uid()
            OR collection_access.invited_identity = (SELECT email FROM profiles WHERE id = auth.uid())
            OR collection_access.invited_identity = (SELECT phone FROM profiles WHERE id = auth.uid())
          )
          AND (collection_access.expires_at IS NULL OR collection_access.expires_at > now())
        )
      )
    )
  );
```

---

### Phase C: First-Class Sharing & Invitations

**Goal**: Enable collection sharing via email/phone with automatic "claiming" when users sign in.

**Sharing Table**:
```sql
CREATE TABLE collection_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,

  -- Identity-based invitations (pre-signup)
  invited_identity text NOT NULL, -- email or phone number

  -- Claimed by user (post-signup)
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,

  -- Access control
  access_level text NOT NULL CHECK (access_level IN ('viewer', 'editor')),
  expires_at timestamp, -- NULL = permanent access

  -- Metadata
  granted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_at timestamp DEFAULT now(),
  claimed_at timestamp, -- When user_id was populated

  -- Prevent duplicate invitations
  UNIQUE(collection_id, invited_identity)
);

CREATE INDEX collection_access_collection_id_idx ON collection_access(collection_id);
CREATE INDEX collection_access_user_id_idx ON collection_access(user_id);
CREATE INDEX collection_access_invited_identity_idx ON collection_access(invited_identity);
```

**Claiming Logic**:
When a user signs in or adds a verified identity (email/phone), automatically "claim" any pending invitations:

```sql
-- Function to claim pending access invitations
CREATE OR REPLACE FUNCTION claim_collection_access()
RETURNS trigger AS $$
BEGIN
  -- Claim by email
  IF NEW.email IS NOT NULL THEN
    UPDATE collection_access
    SET user_id = NEW.id, claimed_at = now()
    WHERE invited_identity = NEW.email
    AND user_id IS NULL;
  END IF;

  -- Claim by phone
  IF NEW.phone IS NOT NULL THEN
    UPDATE collection_access
    SET user_id = NEW.id, claimed_at = now()
    WHERE invited_identity = NEW.phone
    AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_identity_update
  AFTER INSERT OR UPDATE OF email, phone ON profiles
  FOR EACH ROW EXECUTE FUNCTION claim_collection_access();
```

---

## 3. UX Strategy: Zero-Friction Capture

The `/add` endpoint is the most common entry point. Authentication must not break the "iPhone Share Sheet" loop.

### State-Preserved Redirects

**Problem**: OAuth redirects lose application state (URL being captured, notes typed, etc.).

**Solution**: Use `redirectTo` parameter to preserve state across auth flow.

**Implementation**:
```typescript
// /add page logic
const searchParams = useSearchParams()
const urlParam = searchParams?.get('url')
const [user, setUser] = useState(null)

useEffect(() => {
  // Check auth status
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user ?? null)
  })
}, [])

// If not authenticated, show sign-in prompt
if (!user) {
  return (
    <div>
      <h2>Sign in to save to Trove</h2>
      <button onClick={async () => {
        // Preserve current URL in redirectTo
        const currentUrl = window.location.href // e.g., /add?url=https://...
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: currentUrl
          }
        })
      }}>
        Sign in with Google
      </button>
    </div>
  )
}

// After redirect back, user is authenticated and extraction auto-resumes
```

### Permanent Sessions

**Goal**: Minimize "inadvertent logouts" on mobile devices.

**Supabase Client Configuration**:
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    }
  }
)
```

**Session Longevity**:
- Configure Supabase project settings for maximum refresh token lifetime (default: 30 days, can extend to 1 year)
- Enable automatic token refresh on client
- Use persistent storage (localStorage) to survive browser restarts

---

## 4. Data Architecture: Three-Tier Separation

### Tier 1: Global Librarian (items table)

**Principle**: Objective facts are shared across all users.

**Example**: If User A and User B both save `https://example.com/product`, they should link to the **same** `item_id` in the `items` table.

**Deduplication Logic**:
```typescript
// Check if item already exists by source_url (within time window)
const { data: existingItem } = await supabase
  .from('items')
  .select('id')
  .eq('source_url', url)
  .gte('created_at', oneDayAgo) // 24-hour dedup window
  .maybeSingle()

if (existingItem) {
  itemId = existingItem.id
} else {
  // Extract and insert new item
  const { data: newItem } = await supabase
    .from('items')
    .insert({ source_url: url, title, price, ... })
    .select()
    .single()
  itemId = newItem.id
}
```

**Why This Matters**:
- **Data Efficiency**: One canonical record per product, not N copies
- **Price Tracking**: Update once, all users benefit
- **AI Context Quality**: Richer metadata from multiple users' extractions

---

### Tier 2: Personal Context (collection_items table)

**Principle**: Subjective meaning is user-specific.

**Example**: The same watch can be in User A's "Daily Drivers" (note: "love the bracelet") AND User B's "Gift Ideas" (note: "for Dad's birthday").

**Schema**:
```sql
CREATE TABLE collection_items (
  collection_id uuid REFERENCES collections(id),
  item_id uuid REFERENCES items(id),

  -- User-specific context
  notes text, -- "Birthday gift for Shannon"
  position integer, -- Manual ordering within collection
  added_at timestamp DEFAULT now(),

  PRIMARY KEY (collection_id, item_id)
);
```

---

### Tier 3: Shared Access (collection_access table)

**Principle**: Collections can be shared with specific people or made public.

**Use Cases**:
1. **Public Research Collection**: "Best Standing Desks 2026" shared via link, no login required
2. **Family Wishlist**: "Shannon's Birthday Ideas" shared with siblings (editor access)
3. **Temporary Collaboration**: "Kitchen Remodel Research" shared with contractor (expires after 30 days)

**Permission Levels**:
- **Viewer**: Can see collection and items, cannot add/edit/remove
- **Editor**: Can add items, edit notes, reorder items
- **Owner**: Full control, can change visibility, grant/revoke access

---

## 5. Future Roadmap

### Phase D: SMS Interaction (Future)
- Allow account creation and interaction solely via phone number (OTP)
- Use Supabase Phone Auth provider
- Merge email and phone identities into single profile

### Phase E: Temporary Sharing (Future)
- Implement `expires_at` enforcement in RLS policies
- Add UI for "Share for 7 days" or "Share until date"
- Auto-cleanup expired access records

### Phase F: Pricing Strategy (Future)
- **Free Tier**: Unlimited public collections, 3 private collections
- **Pro Tier**: Unlimited private collections, advanced sharing controls
- Public collections remain free forever (growth mechanism)

---

## 6. Migration Strategy

### Migration Path from Single-User to Multi-User

**Existing Data**:
- Current `users` table has placeholder rows (no real auth)
- Current `collections` table has `user_id` but it's meaningless
- Current `items` and `collection_items` are already user-agnostic

**Migration Steps**:
1. **Create profiles table** with auth trigger
2. **Drop old users table** (no real data to preserve)
3. **Migrate collections**: Change `user_id` to `owner_id`, add `visibility`
4. **Create collection_access table**
5. **Apply RLS policies**
6. **Update client code** to handle auth state

**Data Preservation**:
- All `items` preserved (they're already global)
- All `collection_items` preserved (no user dependency)
- Collections: Set `owner_id = NULL` for orphaned collections, allow first user to claim them via UI

---

## 7. Testing Checklist

### Phase A Testing (Auth Foundation)
- [ ] Google Sign-In works on desktop and mobile
- [ ] Profile automatically created on first sign-in
- [ ] User email and avatar populated in profiles table
- [ ] Multiple sign-ins don't create duplicate profiles

### Phase B Testing (RLS)
- [ ] Public collections visible without login
- [ ] Private collections only visible to owner
- [ ] Cannot edit other users' collections
- [ ] Items table readable by anonymous users
- [ ] Items insertable only by authenticated users

### Phase C Testing (Sharing)
- [ ] Can invite user by email (pre-signup)
- [ ] Invited user sees shared collection after signup
- [ ] Viewer can see but not edit
- [ ] Editor can add items and edit notes
- [ ] Expired access is properly blocked

### UX Testing (Add Page)
- [ ] Sign-in prompt shows when logged out
- [ ] After Google OAuth, returns to /add with URL preserved
- [ ] Extraction auto-resumes after redirect
- [ ] Session persists across browser restarts
- [ ] Works on iPhone Safari (PWA mode)

---

## 8. Security Considerations

### RLS Policy Best Practices
- Always use `auth.uid()` for current user checks
- Use `SECURITY DEFINER` for trigger functions that need elevated privileges
- Test policies with multiple user accounts to verify isolation
- Never expose sensitive data in public collections (RLS doesn't redact, it filters rows)

### OAuth Security
- Use Supabase's built-in OAuth providers (don't roll your own)
- Validate `redirectTo` parameter to prevent open redirect attacks
- Set allowed redirect URLs in Supabase dashboard
- Use HTTPS everywhere (enforced by Supabase)

### Sharing Security
- Email/phone invitations should require verification before claiming
- Implement rate limiting on invite creation to prevent spam
- Log all access grants/revocations for audit trail
- Validate `access_level` enum in application logic (not just database constraint)

---

## 9. Performance Considerations

### Indexing Strategy
- `collection_access.invited_identity` (for claim lookups)
- `collection_access.user_id` (for permission checks)
- `collection_access.collection_id` (for listing shared users)
- Composite index on `(collection_id, user_id)` for faster RLS checks

### RLS Policy Optimization
- Avoid subqueries in policies where possible (use JOINs in application logic instead)
- Cache RLS checks at application layer for repeated access within same request
- Use materialized views for complex permission calculations (if needed at scale)

### Session Management
- Use Supabase's built-in session caching (no need to hit DB on every request)
- Refresh tokens in background (automatic with `autoRefreshToken: true`)
- Set reasonable session timeout (24 hours active, 30 days refresh)

---

## 10. Developer Handoff Notes

### Environment Variables Required
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SECRET_KEY=eyJhbGc...

# Google OAuth (configured in Supabase dashboard)
# No additional env vars needed - uses Supabase's OAuth proxy
```

### Supabase Dashboard Configuration
1. **Authentication → Providers → Google**
   - Enable Google provider
   - Add OAuth client ID and secret from Google Cloud Console
   - Add authorized redirect URI: `https://xxx.supabase.co/auth/v1/callback`

2. **Authentication → URL Configuration**
   - Site URL: `https://trove.yoursite.com` (production)
   - Additional Redirect URLs: `http://localhost:3000/add` (development)

3. **Authentication → Email Templates**
   - Customize confirmation email if using email/password (future)

4. **Database → Replication**
   - Enable replication on `profiles` table if using real-time features (future)

### Deployment Checklist
- [ ] Run all migrations on production database
- [ ] Update environment variables in Vercel
- [ ] Test OAuth flow on production domain
- [ ] Verify RLS policies are enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Test with at least 2 user accounts to verify isolation
- [ ] Monitor error logs for RLS policy violations

---

## 11. Common Pitfalls & Solutions

### Pitfall 1: OAuth Redirect Loop
**Problem**: After Google sign-in, user redirects back but URL params are lost.

**Solution**: Use `redirectTo` with full URL including query params.
```typescript
const currentUrl = window.location.href // Includes ?url=...
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: currentUrl }
})
```

### Pitfall 2: RLS Policies Too Restrictive
**Problem**: User can't see their own data after implementing RLS.

**Solution**: Test policies with `SET LOCAL ROLE authenticated;` in psql.
```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "user-uuid-here"}';
SELECT * FROM collections; -- Should only see user's collections
```

### Pitfall 3: Profile Not Created on Signup
**Problem**: Auth trigger doesn't fire, profile row missing.

**Solution**: Check trigger exists and function has correct permissions.
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Verify function has SECURITY DEFINER
\df+ handle_new_user
```

### Pitfall 4: Shared Collections Not Visible
**Problem**: User was invited but can't see shared collection.

**Solution**: Check claiming logic ran and `user_id` is populated.
```sql
-- Check if access was claimed
SELECT * FROM collection_access
WHERE invited_identity = 'user@example.com';
-- user_id should be populated if user signed in

-- Manually claim if needed
UPDATE collection_access
SET user_id = 'uuid-here', claimed_at = now()
WHERE invited_identity = 'user@example.com';
```

---

## 12. Success Metrics

### Phase A (Auth Foundation)
- [ ] 100% of new users auto-create profile on signup
- [ ] 0% duplicate profile creation errors
- [ ] Session persistence >90% (users stay logged in across sessions)

### Phase B (RLS)
- [ ] 0% unauthorized data access in logs
- [ ] Public collections viewable without login
- [ ] Private collections properly isolated

### Phase C (Sharing)
- [ ] 100% of valid invites claimed within 24h of signup
- [ ] 0% duplicate invitation errors
- [ ] Editor permissions work correctly (can add items, not delete collection)

### UX (Add Page)
- [ ] Sign-in flow completes in <30s (including OAuth redirect)
- [ ] URL preservation works 100% of the time
- [ ] Auto-resume extraction after auth works

---

## 13. FAQ

**Q: Why not use Supabase's built-in relationships instead of junction table?**
A: Supabase supports many-to-many relationships via junction tables. We're using the standard pattern (`collection_items`) to store additional metadata (notes, position) per relationship.

**Q: Why `invited_identity` instead of just email?**
A: Future-proofs for phone number invitations (SMS-based auth). A single field handles both email and phone.

**Q: Why `visibility` field instead of just checking `collection_access`?**
A: Performance. Public collections can be served without checking access table. Also enables "unlisted" visibility in future (public URL but not discoverable).

**Q: Why separate `items` table instead of storing items per-user?**
A: Data efficiency and AI context quality. Same product shouldn't be extracted N times. Global librarian enables price tracking, metadata enrichment, and reduces API costs.

**Q: Can a collection be both public and have specific shared users?**
A: Yes. Public means anyone can view. Specific shares can grant editor access even on public collections.

**Q: What happens if user deletes their profile?**
A: `ON DELETE CASCADE` on foreign keys handles cleanup. Their collections and collection_access records are deleted. Items remain (global librarian).

---

## 14. Next Steps After Implementation

1. **Monitor Usage**: Track sign-up rate, session duration, collection creation
2. **Gather Feedback**: Are users understanding public vs private?
3. **Performance Audit**: Check RLS policy query performance with `EXPLAIN ANALYZE`
4. **Security Audit**: Penetration test with multiple accounts
5. **Documentation**: Update user-facing docs with sharing instructions
6. **Pricing Prep**: Implement collection count limits for free tier

---

**Document Version**: 1.0
**Last Updated**: 2026-01-07
**Next Review**: After Phase A implementation
