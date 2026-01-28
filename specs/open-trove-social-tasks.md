# Open Trove Social Platform - Implementation Plan

## Sprint Overview

Transform Trove from single-player utility to multiplayer open-source data platform with:
- Public collection discovery (/explore page)
- Privacy-first profiles with @usernames
- Collection forking (copy items + metadata)
- Adaptive UI (read-only vs owner modes)
- Single-item collection adds for viewers

## Status Assessment

### Already Complete ✅
1. Database schema (profiles, fork_count, is_forkable, collection_forks)
2. Fork API endpoint (/api/collections/[id]/fork) - comprehensive implementation
3. Lineage API endpoint (/api/collections/[id]/lineage)
4. ForkButton component with confirmation dialog
5. ForkBreadcrumb component showing lineage
6. Collection detail page shows fork button for non-owners
7. Homepage links to /explore
8. CollectionGrid and CollectionCard components
9. API endpoint to add items to collections (POST /api/collections/[id]/items)
10. isOwner logic in collection detail page

### To Build ❌
1. /explore page for public collection discovery
2. API endpoint for fetching public collections with attribution
3. Enhanced CollectionCard variant showing fork count + attribution
4. "Add to My Collection" feature in ItemDetailView for viewers
5. Minor adaptive UI refinements for viewer mode

---

## Tasks

### Task 1: Public Collections API Endpoint
**File**: `app/api/collections/public/route.ts`

**Objective**: Create GET endpoint that returns all public collections with metadata and owner attribution without exposing emails or owner_id.

**Requirements**:
- Fetch all collections where `visibility = 'public'`
- Join with `profiles` to get `username`
- Include `fork_count`, `item_count`, `thumbnail_urls` (first 4 items)
- **CRITICAL**: Must NOT return `owner_id` (privacy - viewers don't need it)
- Must NOT expose owner email address
- Return owner as `owner_username` only (`username || email_prefix || 'unknown'`)
- Sort by most recently created first
- Pagination: Support `?limit=100&offset=0` (default limit 100)
- No authentication required (public endpoint, accessible to anonymous users)

**Schema**:
```typescript
interface PublicCollectionData {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  visibility: 'public';
  fork_count: number;
  is_forkable: boolean;
  created_at: string;
  owner_username: string;  // @username or @email_prefix (NEVER owner_id)
  item_count: number;
  thumbnail_urls: string[];
}

interface PublicCollectionResponse {
  success: boolean;
  data?: PublicCollectionData[];
  total?: number;  // Total count for pagination
  error?: string;
}
```

**Technical Notes**:
- Use `getServiceRoleClient()` since this is a public endpoint (bypasses RLS for performance)
- RLS Policy Verification: Public collections readable by anonymous users (migration 004)
- Join: `.select('*, profiles!collections_owner_id_fkey(username, email)')`
- Compute `owner_username = username || email.split('@')[0] || 'unknown'` server-side
- **CRITICAL**: Map result to remove `owner_id` before returning
- Use same thumbnail/count aggregation logic as `/api/collections` (lines 72-100)
- Apply explicit type annotations per CLAUDE.md patterns:
  ```typescript
  type CollectionRow = Database["public"]["Tables"]["collections"]["Row"];
  const data: PublicCollectionData[] = collections.map(c => ({...}));
  ```
- Pagination: Parse `limit` and `offset` from query params
- Total count: Use `.select('*', { count: 'exact', head: false })`
- Test with `npm run build` before committing

**Validation**:
- [ ] Endpoint returns public collections only
- [ ] `owner_id` never included in response (privacy)
- [ ] Owner email never exposed to frontend
- [ ] Includes fork_count, item_count, thumbnails
- [ ] Sorted by created_at DESC
- [ ] Pagination works (limit/offset)
- [ ] Anonymous users can access endpoint
- [ ] Builds without TypeScript errors

---

### Task 2: Explore Page UI
**File**: `app/explore/page.tsx`

**Objective**: Create discovery page showing all public collections in a grid with attribution and fork counts.

**Requirements**:
- Fetch data from `/api/collections/public`
- Display using PublicCollectionGrid (new component using PublicCollectionCard)
- Header: "EXPLORE PUBLIC TROVES" in Terminal Noir style
- Show "X public collections" count
- Loading state with 6 skeleton cards (2×2 thumbnail grid shimmer)
- Empty state: "No public collections yet. Be the first to make yours public!"
- Error state: "Failed to load collections. Try again later." with retry button
- Terminal box container with header
- No authentication required (anonymous users can browse)
- Pagination: "Load More" button at bottom (if total > limit)

**UI Structure**:
```tsx
<main className="min-h-screen bg-void text-white p-6">
  <div className="max-w-7xl mx-auto">
    {/* Header */}
    <div className="mb-8">
      <h1 className="font-mono text-3xl font-bold tracking-widest uppercase text-open-green mb-2">
        Explore Public Troves
      </h1>
      <p className="font-mono text-slate-400 text-sm">
        {count} public collections • Fork any to start your own
      </p>
    </div>

    {/* Grid */}
    <PublicCollectionGrid collections={collections} />
  </div>
</main>
```

**Component**: `PublicCollectionGrid`
- Use CollectionCard but enhance with fork count badge
- Show "@username • X items • Y forks" metadata
- Hover state: border-open-green
- Link to `/collections/{id}` (public view)

**Technical Notes**:
- Use SWR for data fetching: `useSWR('/api/collections/public?limit=100&offset=0', fetcher)`
- No authentication required, fully public (accessible to anonymous users)
- Mobile-responsive grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6`
- Loading skeleton: 6 cards with animated shimmer (use existing SkeletonCard pattern)
- Error state: Show toast notification + retry button
- Pagination: Track offset state, append results on "Load More" click

**Validation**:
- [ ] Displays public collections in grid
- [ ] Shows fork count with GitFork icon
- [ ] Shows attribution (@username)
- [ ] Links to collection detail pages
- [ ] Mobile responsive (2/3/4 column breakpoints)
- [ ] Loading state shows 6 skeleton cards
- [ ] Empty state shows helpful message
- [ ] Error state shows retry option
- [ ] Anonymous users can access page

---

### Task 3: Enhanced CollectionCard for Public View
**File**: `app/collections/components/PublicCollectionCard.tsx` (new)

**Objective**: Create variant of CollectionCard that shows attribution and fork count for explore page.

**Requirements**:
- Same visual structure as CollectionCard (2×2 thumbnail grid)
- Add metadata row below item count:
  - "@username" in text-open-green
  - Fork count with GitFork icon
  - Format: "@username • X forks" or just "@username" if 0 forks
- Hover state: border-open-green transition
- Link to `/collections/{id}`

**Component Interface**:
```typescript
interface PublicCollectionCardProps {
  collection: {
    id: string;
    name: string;
    owner_username: string;
    item_count: number;
    fork_count: number;
    thumbnail_urls: string[];
  };
}
```

**Design**:
```tsx
<Link href={`/collections/${id}`}>
  {/* 2×2 thumbnail grid */}
  <div className="aspect-square grid grid-cols-2 gap-1 p-2">
    {/* thumbnails */}
  </div>

  {/* Info */}
  <div className="p-4 border-t border-slate-800">
    <h3 className="font-mono font-semibold text-white mb-1 truncate">
      {name}
    </h3>
    <p className="text-xs font-mono text-slate-400 mb-2">
      {item_count} items
    </p>
    <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
      <span className="text-open-green">@{owner_username}</span>
      {fork_count > 0 && (
        <>
          <span>•</span>
          <GitFork className="w-3 h-3" />
          <span>{fork_count}</span>
        </>
      )}
    </div>
  </div>
</Link>
```

**Validation**:
- [ ] Shows attribution with @username
- [ ] Shows fork count when > 0
- [ ] Matches Terminal Noir design system
- [ ] Hover effects work
- [ ] Mobile responsive

---

### Task 0: Add isOwner Prop to ItemDetailView (PREREQUISITE)
**Files**:
- `app/collections/components/ItemDetailView/ItemDetailContent.tsx`
- `app/collections/components/ItemDetailView/index.tsx`
- `app/collections/[id]/page.tsx`

**Objective**: **CRITICAL FIX** - Add owner detection to ItemDetailView to enable viewer mode with read-only UI.

**Requirements**:
- Add `isOwner: boolean` prop to `ItemDetailContentProps`
- Pass `isOwner` from collection detail page (line 83 already computes it)
- Conditionally hide owner-only actions when `isOwner === false`:
  - Edit Mode button (line 768-792)
  - Move to Trash section (line 797-876)
  - Re-extract button (if present)
- Keep visible for viewers:
  - Item details (title, price, category, tags)
  - Source URL link
  - Collection membership indicator
  - Notes (read-only display)
- Prepare for Task 4: Add placeholder for "Add to My Collection" button (show when !isOwner)

**Technical Notes**:
- Update `ItemDetailContentProps` interface:
  ```typescript
  interface ItemDetailContentProps {
    item: ItemWithCollectionMetadata;
    collectionId: string;
    isOwner: boolean;  // NEW
    onUpdate?: () => void;
    onClose: () => void;
  }
  ```
- In collection page, pass prop to ItemDetailView:
  ```tsx
  <ItemDetailView
    isOpen={isOpen}
    collectionId={id}
    isOwner={isOwner}  // Pass computed value
    onUpdate={handleItemUpdate}
  />
  ```
- Wrap edit/delete UI in `{isOwner && (<div>...</div>)}`
- Notes textarea: Change to read-only paragraph when !isOwner

**Validation**:
- [ ] isOwner prop added to ItemDetailContent
- [ ] Edit Mode button hidden for viewers
- [ ] Move to Trash hidden for viewers
- [ ] Notes show as read-only for viewers
- [ ] Collection page passes isOwner correctly
- [ ] No TypeScript errors
- [ ] `npm run build` passes

---

### Task 4: "Add to My Collection" in ItemDetailView
**File**: `app/collections/components/ItemDetailView/ItemDetailContent.tsx`

**Objective**: Enable viewers to add individual items to their own collections without forking entire collection.

**Prerequisites**: Task 0 must be complete (isOwner prop exists).

**Requirements**:
- Show "Add to My Collection" button when `!isOwner` (viewer mode)
- Button location: Replace Edit/Trash section (line 767-876)
- Opens sheet/dialog to select target collection
- Fetches user's collections via `/api/collections`
- Calls POST `/api/collections/{target_id}/items` with `item_id`
- Success: Toast notification "Added {itemName} to {collectionName}" + close dialog
- Handle "already in collection" case: Show "Item already in {collectionName}" toast
- Auth guard: If not logged in, show "Log in to add items to your collection" button that redirects to `/auth/login?returnTo={current_url}`

**Component Structure**:
```tsx
// In ItemDetailView.tsx
{!isOwner && (
  <button
    onClick={() => setAddToCollectionOpen(true)}
    className="px-4 py-2 border border-slate-800 hover:border-open-green text-slate-300 hover:text-open-green font-mono font-bold rounded-lg transition-colors flex items-center gap-2"
  >
    <Plus className="w-4 h-4" />
    Add to My Collection
  </button>
)}

<AddToCollectionSheet
  isOpen={addToCollectionOpen}
  onClose={() => setAddToCollectionOpen(false)}
  itemId={item.id}
  itemName={item.title}
/>
```

**New Component**: `AddToCollectionSheet`
- Props: `isOpen, onClose, itemId, itemName`
- Fetch user collections via SWR
- List collections with radio select
- "Create New Collection" option at bottom
- Loading state during API call
- Toast on success: "Added {itemName} to {collectionName}"
- Error handling with toast

**Technical Notes**:
- Check `userId` from Supabase client (use existing pattern from line 66-74 in page.tsx)
- If no `userId`, show "Log in to add items" button (not full sheet)
- Use existing `/api/collections/{id}/items` POST endpoint (lines 169-287 in items/route.ts)
- Backend already handles "already exists" case (line 221-248) - shows update success
- Revalidate user collections after add: `mutateUserCollections()`
- Mobile-friendly sheet component (bottom drawer on mobile, modal on desktop)
- Verify `/auth/login` supports `returnTo` query param

**Validation**:
- [ ] Button shows only for viewers (!isOwner)
- [ ] Button hidden for owners
- [ ] Opens collection selector sheet when logged in
- [ ] Shows login prompt when anonymous
- [ ] Lists user's collections
- [ ] Successfully adds item to selected collection
- [ ] Shows success toast with collection name
- [ ] Handles "already in collection" gracefully
- [ ] Redirects to login with returnTo param
- [ ] Mobile responsive
- [ ] `npm run build` passes

---

### Task 5: Adaptive UI Refinements for Viewer Mode
**File**: `app/collections/[id]/page.tsx`

**Objective**: Ensure all owner-only controls are hidden for viewers and viewer experience is optimized.

**Current State**: Already has isOwner logic and conditionally shows fork button.

**Refinements Needed**:
1. Audit all buttons/actions in header
2. Ensure viewers see:
   - ✅ Fork button (if collection.is_forkable) ← line 225-231, already correct
   - ✅ Share for AI button ← line 246-257, already visible to all
   - ❌ Sort options (hidden for viewers) ← line 297-308 shows owner-only, **clarify: should viewers sort?**
   - ✅ View toggle (grid/list) ← line 286-290, visible to all
   - ❌ Add Existing button (owner only) ← line 234-244, already correct
   - ❌ Share with People button (owner only) ← line 259-273, already correct
   - ❌ Settings button (owner only) ← line 275-284, already correct
   - ❌ Reorder button (owner only) ← line 292-308, already correct

3. Verify ItemDetailView hides (Task 0 prerequisite):
   - ❌ Edit Item button
   - ❌ Edit Notes textarea (show as read-only text)
   - ❌ Move to Trash section
   - ❌ Re-extract button (if present)
   - ✅ Shows "Add to My Collection" instead (Task 4)

**Changes**:
- **DECISION REQUIRED**: Should viewers be able to sort? Current code hides sort from viewers (line 297-308). If yes, change condition to `{items.length > 0 && (...)}`
- Add visual indicator for viewers: Small badge "Public Collection" in header (next to item count)
- Ensure AI overview visible to viewers (currently line 373-385, no isOwner guard - correct)
- Test public collection access without auth (should work per RLS policy from migration 004)

**Technical Notes**:
- The page already has good isOwner checks (line 225-244)
- Task 0 adds isOwner prop to ItemDetailView (critical prerequisite)
- RLS Policy: `visibility = 'public' OR owner_id = auth.uid() OR EXISTS (...)` allows anonymous reads
- Anonymous access test: Open `/collections/{public_collection_id}` in incognito mode

**Validation**:
- [ ] Viewers see fork button for forkable collections
- [ ] Owner-only buttons hidden for viewers (Add, Share, Settings, Reorder)
- [ ] Sort button visibility clarified (viewer access decision)
- [ ] View toggle visible to viewers
- [ ] AI overview visible to viewers
- [ ] ItemDetailView shows viewer actions (Task 4)
- [ ] Public collections accessible without login (test in incognito)
- [ ] "Public Collection" badge visible for viewers
- [ ] No TypeScript errors
- [ ] `npm run build` passes

---

## Testing Checklist

After all tasks complete:

1. **Build Test**: `npm run build` must pass with no errors
2. **Type Check**: `npm run type-check` must pass
3. **Functional Tests**:
   - [ ] Navigate to /explore as anonymous user
   - [ ] See public collections with fork counts and attribution
   - [ ] Click collection to view details (read-only)
   - [ ] Fork button works (requires login)
   - [ ] Log in, fork a collection
   - [ ] Verify fork appears in my collections
   - [ ] Verify fork count incremented on source
   - [ ] Click item in public collection (viewer mode)
   - [ ] "Add to My Collection" button visible
   - [ ] Add single item to existing collection
   - [ ] Verify item appears in target collection
   - [ ] Make own collection public
   - [ ] Verify it appears in /explore

4. **RLS Security Test**:
   - [ ] Anonymous users can view public collections (test in incognito: `/collections/{public_id}`)
   - [ ] Anonymous users cannot view private collections (should 404)
   - [ ] Owner `owner_id` UUID never exposed in `/api/collections/public` responses
   - [ ] Owner emails never exposed in API responses (only username)
   - [ ] Viewers cannot edit collections they don't own (RLS enforces)
   - [ ] Fork API rejects self-forking (already implemented in fork/route.ts line 72)
   - [ ] Fork API rejects non-public collections (line 57-62)
   - [ ] Fork API rejects non-forkable collections (line 64-69)

---

## Implementation Order

1. **Task 0**: Add isOwner Prop to ItemDetailView (**CRITICAL PREREQUISITE** - blocks Task 4)
2. **Task 1**: Public Collections API (foundation)
3. **Task 3**: Enhanced CollectionCard (UI component)
4. **Task 2**: Explore Page (uses API + component)
5. **Task 4**: Add to My Collection (viewer interaction - requires Task 0)
6. **Task 5**: Adaptive UI Refinements (polish)

---

## Design System Reference

**Terminal Noir Palette**:
- `--color-void`: #050505 (primary bg)
- `--color-open-green`: #10b981 (accent)
- `--color-slate-800`: #1e293b (borders)

**Typography**:
- Font: JetBrains Mono (font-mono)
- Headers: uppercase, tracking-widest
- Colors: text-slate-300 (body), text-slate-500 (secondary)

**Key Classes**:
- Buttons: `bg-open-green hover:bg-emerald-400 text-void font-mono font-bold`
- Borders: `border border-slate-800 hover:border-open-green`
- Cards: `bg-slate-deep rounded-lg shadow-hard`

---

## Notes

- All database schema already in place (migration 016_forking.sql)
- Fork API already handles schema cloning, filter preferences, and lineage
- Homepage already links to /explore (line 50 in app/page.tsx)
- ForkButton component already exists with dialog UI
- This sprint is primarily frontend + one new API endpoint
- Focus on discovery UX and viewer affordances
