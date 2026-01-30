# Collection Starring Feature - Implementation Plan

## Overview
Add ability for users to "star" (bookmark/follow) public collections owned by others. Users can view starred collections in a dedicated dashboard tab.

## Sprint 1: Database Foundation
**Goal:** Create database schema and RLS policies for collection stars

### Task 1.1: Create collection_stars migration
- **File:** `supabase/migrations/020_collection_stars.sql`
- **Actions:**
  - Create `collection_stars` table with columns:
    - `id` (uuid, primary key, default uuid_generate_v4())
    - `user_id` (uuid, foreign key to profiles.id, not null)
    - `collection_id` (uuid, foreign key to collections.id, not null)
    - `created_at` (timestamptz, default now())
  - Add composite unique constraint on (user_id, collection_id)
  - Add foreign key constraints with ON DELETE CASCADE
  - Create index on user_id for fast lookups
  - Create index on collection_id for star counts
  - Add `star_count` column to collections table (denormalized for performance)
  - Create trigger to update star_count on insert/delete (like fork_count pattern)
- **RLS Policies:**
  - Enable RLS on collection_stars
  - SELECT: Users can see their own stars (`user_id = auth.uid()`)
  - INSERT: Users can star collections (`user_id = auth.uid()`)
  - DELETE: Users can unstar their own stars (`user_id = auth.uid()`)
- **Validation:** Apply migration locally, verify table structure and policies

### Task 1.2: Generate TypeScript types
- **Action:** Run `npm run generate-types` to update database types
- **Validation:** Verify `types/database.ts` includes CollectionStars table types

## Sprint 2: Backend API
**Goal:** Create API endpoints for starring/unstarring and fetching starred collections

### Task 2.1: Star status and toggle endpoint
- **File:** `app/api/collections/[id]/star/route.ts`
- **Actions:**
  - Create GET handler:
    - Returns `{ isStarred: boolean, starCount: number }`
    - Use denormalized star_count from collections table
    - Check collection_stars for current user
  - Create POST handler (toggle):
    - Authenticate user with `getAuthenticatedServerClient()`
    - Validate user cannot star their own collection
    - Check if already starred:
      - If yes: DELETE the row
      - If no: INSERT the row
    - Use explicit type casting: `(client as any).from("collection_stars").insert(insertData)`
    - Return `{ isStarred: boolean, starCount: number }`
- **Type Safety:**
  ```typescript
  type StarInsert = Database["public"]["Tables"]["collection_stars"]["Insert"];
  const insertData: StarInsert = { user_id: user.id, collection_id: collectionId };
  ```
- **Error Handling:** Return proper HTTP codes (401, 403 for self-star, 404, 500)
- **Validation:** Test with curl/Postman for both toggle states

### Task 2.2: Get starred collections endpoint
- **File:** `app/api/user/starred/route.ts`
- **Actions:**
  - Create GET handler
  - Authenticate user
  - Query collection_stars joined with collections and profiles using Supabase syntax:
    ```typescript
    const { data } = await client
      .from("collection_stars")
      .select(`
        created_at,
        collections!inner (
          id, name, description, visibility, created_at, owner_id, star_count,
          profiles!collections_owner_id_fkey (username, email)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    ```
  - Transform response to flatten nested structure
  - Return array of collections with owner info
- **Type Safety:** Cast response explicitly to avoid `never` type errors
- **Validation:** Test endpoint returns correct data structure

### Task 2.3: Extend public collections endpoint with star status
- **File:** `app/api/collections/public/route.ts`
- **Actions:**
  - For authenticated users, include `is_starred` field in response
  - Add LEFT JOIN to collection_stars table for current user
  - Return same structure but with optional `is_starred: boolean` field
- **Type Safety:** Define StarredPublicCollection type extending PublicCollection
- **Validation:** Test returns correct star status for logged-in and anonymous users

## Sprint 3: UI Components
**Goal:** Create reusable StarButton component with optimistic updates

### Task 3.1: Create StarButton component
- **File:** `app/components/StarButton.tsx`
- **Props:**
  ```typescript
  interface StarButtonProps {
    collectionId: string;
    initialIsStarred: boolean;
    initialStarCount: number;
    ownerId?: string; // To check if user owns collection
    className?: string;
  }
  ```
- **Behavior:**
  - Use useState for isStarred, starCount, and isLoading
  - Check authentication: If not logged in, redirect to login or show prompt
  - Check ownership: If ownerId matches current user, hide button (can't star own collection)
  - Optimistic UI: Toggle state immediately on click
  - API call: POST to /api/collections/[id]/star (toggle endpoint)
  - Revert state if API fails (show toast error using sonner)
  - Disable button during API call to prevent double-clicks
- **Styling (Terminal Noir):**
  - Use Star icon from lucide-react
  - Starred: `text-open-green fill-open-green` (matches active states)
  - Unstarred: `text-slate-500` (outline only)
  - Terminal Noir style: `font-mono text-xs` for count
  - Loading state: opacity-50 + cursor-not-allowed
- **Validation:** Test optimistic updates, error handling, and unauthenticated state

### Task 3.2: Integrate StarButton into PublicCollectionCard
- **File:** `app/components/PublicCollectionCard.tsx`
- **Actions:**
  - Add optional `isStarred` and `starCount` props
  - **CRITICAL:** Card is currently wrapped in `<Link>` - can't nest button inside
  - **Solution:** Add StarButton OUTSIDE the Link wrapper in footer area
    - Use `onClick={(e) => e.stopPropagation()}` to prevent navigation when clicking star
    - OR refactor card structure to separate clickable vs interactive zones
  - Pass collection ID, star state, and owner_id to StarButton
  - Position in bottom-right of card alongside fork count
- **Styling:** Match Terminal Noir aesthetic, align with existing fork button styling
- **Validation:** Verify button appears, functions, and doesn't trigger navigation

## Sprint 4: Dashboard Integration
**Goal:** Add "Starred" tab to collections dashboard

### Task 4.1: Create useStarredCollections hook
- **File:** `app/hooks/useStarredCollections.ts`
- **Actions:**
  - Fetch from `/api/user/starred`
  - Handle loading and error states
  - Return typed collection data
- **Type:** Define StarredCollection type
- **Validation:** Hook fetches and returns correct data

### Task 4.2: Update collections page with tabs
- **File:** `app/collections/page.tsx`
- **Actions:**
  - Add state: `const [activeTab, setActiveTab] = useState<'my-collections' | 'starred'>('my-collections')`
  - Create tab UI above collection grid:
    - "My Troves" tab
    - "Starred" tab
    - Use Terminal Noir styling (active: `bg-slate-800 text-open-green`, inactive: `text-slate-400`)
  - Conditionally render grid based on activeTab
  - When activeTab === 'starred':
    - Use useStarredCollections hook
    - Render PublicCollectionCard with isStarred={true}
    - Show empty state if no starred collections
- **Styling:** Match existing Terminal Noir design system
- **Validation:** Tabs switch correctly, data loads for each view

### Task 4.3: Add StarButton to public collection views
- **File:** `app/collections/public/page.tsx` (or wherever public collections are shown)
- **Actions:**
  - Star status now comes from extended `/api/collections/public` endpoint (Task 2.3)
  - Pass isStarred, starCount, and ownerId to PublicCollectionCard
  - Display star count on all collection cards (REQUIRED, not optional)
- **Validation:** Star button appears on public collection listings with correct state

## Sprint 5: Polish & Testing
**Goal:** Production-ready with pre-deployment verification

### Task 5.1: Pre-deployment verification
- **Actions:**
  - Run `npm run build` - must pass
  - Run `npm run type-check` - must pass
  - Test starring flow end-to-end:
    - Star a collection
    - Verify it appears in Starred tab
    - Unstar it
    - Verify it's removed from Starred tab
  - Test optimistic UI and error handling
  - Test RLS policies (try starring as different users)

### Task 5.2: Optional enhancements (if time permits)
- Add loading skeleton for starred collections
- Add animations for star/unstar transitions
- Add sort options for starred collections (by star date, by name, etc.)
- Add "Recently starred" section to dashboard

## Technical Notes

### Supabase Type Safety Patterns
Follow patterns from CLAUDE.md:

```typescript
// Insert
type StarInsert = Database["public"]["Tables"]["collection_stars"]["Insert"];
const insertData: StarInsert = {
  user_id: user.id,
  collection_id: collectionId,
};
await (client as any).from("collection_stars").insert(insertData);

// Delete
await client
  .from("collection_stars")
  .delete()
  .eq("user_id", user.id)
  .eq("collection_id", collectionId);

// Query with joins - explicit typing
type StarredCollectionRow = {
  id: string;
  name: string;
  description: string | null;
  // ... other collection fields
  username: string;
  avatar_url: string | null;
  starred_at: string;
};
```

### Pre-Deployment Checklist
- [ ] All migrations applied successfully
- [ ] `npm run build` passes
- [ ] TypeScript types generated and working
- [ ] RLS policies tested
- [ ] API endpoints tested
- [ ] UI components tested
- [ ] No console errors
- [ ] Terminal Noir design system followed

## Dependencies
- Existing: collections table, profiles table
- Existing: PublicCollectionCard component
- Existing: getAuthenticatedServerClient helper
- New: lucide-react Star icon
