# TODO

## Phase 1: Setup & Database ✅ COMPLETE
- [x] Initialize Next.js project
- [x] Set up Supabase project
- [x] Create database schema
- [x] Add environment variables
- [x] Test DB connection

## Phase 2: Extraction Pipeline ✅ COMPLETE
- [x] Create /api/extract endpoint
- [x] Implement Jina AI fetch
- [x] Implement Claude extraction
- [x] Add error handling
- [x] Test with 5 different URLs

## Phase 2B: Database Integration & Many-to-Many Schema ✅ COMPLETE
- [x] Migrate schema to many-to-many (items ↔ collections)
- [x] Create collection_items junction table with metadata
- [x] Update TypeScript database types
- [x] Create /api/items POST endpoint (save extracted data)
- [x] Create /api/collections CRUD endpoints
- [x] Create /api/collections/[id]/items GET/POST endpoints
- [x] Test items in multiple collections
- [x] Verify collection-specific notes and position
- [x] Update documentation

## Phase 2C: Schema Refinements & Caching ✅ COMPLETE
- [x] Add UNIQUE constraint on source_url (prevent duplicate entries)
- [x] Add last_viewed_at timestamp to items (for staleness tracking)
- [x] Move extraction prompt to dedicated file (prompts/extraction.txt)
- [x] Add needs_review flag for low confidence extractions (< 0.7)
- [ ] Implement URL deduplication check (24hr cache window)
- [ ] Add RLS policies preparation notes for future auth

## Phase 3: /add Page - iOS Shortcuts Integration ✅ COMPLETE
- [x] Create /add page with mobile-first responsive design
- [x] Handle URL parameter from iOS Shortcut (?url=...)
- [x] **Browser-based flow**: Show loading → POST /api/items → Show success
- [x] Loading state with animation (3-10s extraction duration)
- [x] Success view with extracted item preview
- [x] Handle low confidence items (needs_review flag) with visual warning
- [x] Error handling with retry functionality
- [x] Duplicate URL detection (saves API cost)
- [x] Test full flow: iOS Share Sheet → Browser → Extraction → Success

**Note:** Original plan included "Shadow Save" (instant save with background extraction and polling). After UX analysis, chose simpler synchronous browser-based flow with rich loading feedback for the 3-10 second extraction duration.

## Phase 3B: /add Page Refactor - "Context-First Capture" ✅ COMPLETE
**Goal**: Transform /add from blocking "wait for AI" to active "define intent while AI works" flow.

**Key Innovation**: User types context (notes, collections) while extraction happens in background. Race condition handling via `saveIntent` pattern ensures save happens as early as possible.

### Phase 3B.1: Foundation (Types & Hooks) ✅ COMPLETE
- [x] Create `/types/capture.ts` - State machine type definitions
  - CaptureState, ExtractionState, CaptureContext, SaveIntent types
- [x] Create `/app/add/hooks/useCaptureState.ts` - State management logic
  - State machine transitions
  - Race condition handling (saveIntent pattern)
- [x] Create `/app/add/hooks/useMockProgress.ts` - Progress bar timing
  - 0→80% over 5s, exponential slowdown, freeze at 80%, jump to 100% on complete

### Phase 3B.2: Core UI Components ✅ COMPLETE
- [x] Create `/app/add/components/SourceUrlBadge.tsx` - URL display pill
- [x] Create `/app/add/components/MockProgressBar.tsx` - Progress indicator
  - Status text: "Librarian is cataloging details..."
  - Visual states: active (blue), stalled (amber), complete (green), error (red)
- [x] Create `/app/add/components/ContextForm.tsx` - Notes textarea (auto-focused)
  - Label: "Add Your Context"
  - Placeholder: "e.g., Research for the kitchen remodel, a birthday gift idea for Shannon..."
- [x] Create `/app/add/components/CollectionSelector.tsx` - Multi-select chips
  - Horizontal scrollable chip list
  - Label: "File Under" or "Organize Into"
  - Default "Inbox" pre-selected

### Phase 3B.3: Extraction Components ✅ COMPLETE
- [x] Create `/app/add/components/ExtractedItemCard.tsx`
  - Skeleton state with pulse animation
  - Smooth transition to real data
  - Confidence badge (amber if < 0.7)
- [x] Create `/app/add/components/RecentlyTroved.tsx`
  - Horizontal scroll container
  - Last 5 items added
- [x] Create `/app/add/components/CaptureActions.tsx`
  - Save button with states: "Save", "Saving...", "Finalizing..."
  - Cancel button

### Phase 3B.4: API Updates ✅ COMPLETE
- [x] No modification to `/app/api/items/route.ts` needed - already supports collections parameter
  - Existing endpoint handles extraction + collection assignment in one call
  - Race condition handling done client-side in useCaptureState hook
- [x] Create `/app/api/items/recent/route.ts` - Recent items endpoint
  - GET endpoint returning last 5 items (ORDER BY created_at DESC LIMIT 5)
- [x] Create Inbox collection auto-creation helper
  - `ensureInboxCollection()` function in `lib/inbox.ts`
  - Check if "Inbox" exists, create if not

### Phase 3B.5: Main Page Integration ✅ COMPLETE
- [x] Refactor `/app/add/page.tsx` - Replace blocking flow with Context-First
  - Wire all new components
  - Implement state machine
  - Handle race conditions with saveIntent
  - Parallel fetch on mount: collections + recent items
  - Preserve iOS shortcut entry (`?url=` parameter)
  - Auto-focus textarea on load

### Phase 3B.6: Polish & Error Handling ✅ COMPLETE (Core Items)
- [x] Validation: Require notes OR collections (validated in useCaptureState.ts:206)
- [x] Error handling: Extraction failures, network errors (handled in useCaptureState.ts)
- [x] Loading states for collections fetch (collectionsLoading state in page.tsx)
- [x] Keyboard shortcuts (Cmd/Ctrl+Enter = save, Escape = reset) - tested and working
- [ ] Duplicate URL: Show existing item, allow adding new context (deferred - needs backend)
- [ ] Success animation after save (deferred - would add complexity)
- [ ] Extraction timeout handling (deferred - extraction usually completes in <30s)

**Testing Checklist (Playwright + Manual):**
- [x] **[Playwright]** Dev server running, navigate to /add page
- [x] **[Playwright]** URL parameter parsing (?url=...) works
- [x] **[Playwright]** Textarea auto-focuses on load
- [x] **[Playwright]** Progress bar animates smoothly (0→82%→100% with stalled state)
- [x] **[Playwright]** Collections load and multi-select works
- [x] **[Playwright]** Notes persist during extraction
- [x] **[Playwright]** Skeleton → real data transition smooth
- [x] **[Playwright]** Save after extraction: Immediate save (tested with notes + collection)
- [x] **[Playwright]** Recently Troved section loads
- [x] **[Playwright]** Error states display properly (no URL parameter)
- [x] **[Playwright]** Success view shows correct collection count
- [x] **[Playwright]** "Add Another Item" resets form correctly
- [x] **[Playwright]** Keyboard shortcut: Cmd/Ctrl+Enter saves when valid
- [x] **[Playwright]** Keyboard shortcut: Escape resets form
- [x] **[Manual]** iOS shortcut deep link works (test on actual iPhone) - validated by user
- [ ] **[Manual]** Save before extraction: Shows "Finalizing...", completes when done (needs slower endpoint to test)
- [ ] **[Manual]** Confidence badge shows for score < 0.7 (need low-confidence item to test)

**Race Condition Scenarios:**
1. User saves before extraction completes → saveIntent='pending' → "Finalizing..." → auto-save on complete
2. Extraction completes before user saves → saveIntent='ready' → "Item extracted - ready to save"
3. Simultaneous completion → Handle with optimistic state management

**Note**: Detailed plan at `/Users/cminnich/.claude/plans/fuzzy-hugging-feigenbaum.md`

## Phase 3.5: Design System Implementation
**Goal**: Establish visual identity and core CSS patterns for Phase 4 collections view.

### Visual Foundation
- [x] Create DESIGN.md (design system documentation)
- [x] Create Graph T logo (v1)
  - [x] Static SVGs: /public/logo.svg, /public/logo-dark.svg
  - [x] React component: app/components/Logo.tsx
- [x] Add design system CSS variables to app/globals.css
  - [x] Carbon/Gray palette for backgrounds and borders
  - [x] Indigo accent colors for actions
  - [x] Amber status colors for low confidence warnings
- [ ] Configure Tailwind theme extension in tailwind.config.ts
  - [ ] Extend colors to include indigo-accent, amber-status
  - [ ] Add custom gray shades if needed
- [ ] Import Inter font via next/font/google
- [ ] Add JetBrains Mono for data/code display

### Component Patterns (for Phase 4)
- [ ] Define Dense List pattern specifications
  - Row height: 80-100px
  - Metadata: Brand, Price, Category, Tags, Item Type
  - Thumbnail: 64x64px
- [ ] Define Grid View pattern specifications
  - 2 columns mobile, 3-4 columns tablet/desktop
  - Square aspect ratio cards
  - Metadata overlay on hover/long-press
- [ ] Mobile touch target guidelines (44x44px minimum)
- [ ] Swipe gesture specifications (left = remove, right = actions)

### AI-Specific Patterns
- [ ] Standardize confidence badge styling (amber warning when < 0.7)
- [ ] Design "Copy for AI" button and output format
- [ ] Plan staleness indicator for items (last_viewed_at > 30 days)

**Note**: This phase is documentation and CSS foundation only. Actual UI implementation happens in Phase 4.

## Phase 4: Collections View (Mobile-First) ✅ COMPLETE
- [x] **Mobile-responsive CSS** - Touch-friendly, works on iPhone primarily
- [x] Create /collections page with card-based layout (2×2 thumbnail grids)
- [x] List all collections with item counts and visual previews
- [x] View items in a specific collection
- [x] Show collection-specific notes on items (in ItemDetailSheet)
- [x] Reorder items within collection (drag-and-drop with @dnd-kit, position sort only)
- [x] Show which collections each item belongs to (item detail sheet)
- [x] Sort options (by position, added_at, price_asc, price_desc, category)
- [x] Grid/List view toggle with localStorage persistence
- [x] Item detail bottom sheet with full metadata and edit capabilities
- [x] Edit mode with drag handles (500ms long-press activation)
- [x] Auto-exit edit mode after 5s inactivity
- [x] Confidence badges on low-confidence items (< 0.7)
- [x] Mobile navigation (bottom tab bar) and desktop navigation
- [x] **[Playwright]** Test collections list page rendering (4 collections found, thumbnails working)
- [x] **[Playwright]** Test item view within collection (grid and list views working)
- [x] **[Playwright]** Verify responsive layout on mobile viewport (375x667 - passed)
- [x] **[Playwright]** Test sort interactions (all 5 sort options working)
- [x] **[Playwright]** Test item detail sheet (opens, displays data, edit button visible)
- [x] **[Playwright]** Test navigation (mobile nav, Collections/Add/Settings links working)
- [x] **[Playwright]** Accessibility audit (ARIA labels, touch targets, keyboard nav, focus management, semantic HTML - all passed)

**Deferred to Later Phases:**
- [ ] Create new collection modal (deferred - use Supabase dashboard for now)
- [ ] Add/remove items from current collection (deferred - Phase 5)
- [ ] Filter by category/tags (deferred - Phase 5)
- [ ] "Needs Review" section for low confidence items (deferred - Phase 5)
- [ ] Item staleness indicator (last_viewed_at > 30 days) (deferred - Phase 7)

**Implementation Details:**
- Built with @dnd-kit for touch-optimized drag-and-drop
- SWR for server state caching and optimistic updates
- Zustand for client UI state (modals, edit mode)
- localStorage for user preferences (view mode, sort order per collection)
- Bottom sheet pattern for item details (mobile-first)
- All tests passing (7 comprehensive scenarios + 5 accessibility checks)

## Phase 5: AI Export - "Context Bridge"
- [ ] Add "Copy for AI" button with Markdown + JSON hybrid format
- [ ] Human-readable Markdown with embedded JSON blobs for LLM parsing
- [ ] Include rich metadata (images, prices, attributes, collection notes)
- [ ] Create shareable API endpoint: GET /api/v1/collections/[id]/context
- [ ] Public, read-only endpoint for sharing collections with AI agents
- [ ] Add MCP (Model Context Protocol) compatibility notes
- [ ] Test with actual Claude chat and validate parsing accuracy
- [ ] Add "Share Collection" button that generates public URL
- [ ] **[Playwright]** Test "Copy for AI" button click and clipboard content
- [ ] **[Playwright]** Verify API endpoint returns expected format
- [ ] **[Playwright]** Test share URL generation and navigation

## Phase 6: iPhone Integration
- [ ] Create iOS Shortcut
- [ ] Host shareable link
- [ ] Create /install page with instructions
- [ ] Test end-to-end on iPhone

## Phase 7: Polish & Performance
- [ ] Loading states and skeletons
- [ ] Error messages and toast notifications
- [ ] Empty states with helpful prompts
- [ ] Smooth animations and transitions
- [ ] Implement URL deduplication/caching (24hr window)
- [ ] Price refresh for stale items (last_viewed_at > 30 days)
- [ ] Performance optimization (image lazy loading, pagination)

## Phase 8: Authentication & Multi-User System ✅ COMPLETE
**Goal**: Transform Trove from single-user to multi-user with authentication, sharing, and proper data isolation.

### Phase 8.1: Database Overhaul ✅ COMPLETE
- [x] Create migration 004_auth_and_sharing.sql
- [x] Drop old `users` table (placeholder only)
- [x] Create `profiles` table (id, email, phone, avatar_url)
- [x] Create auth trigger to auto-sync `auth.users` to `public.profiles`
- [x] Migrate `collections` table: `user_id` → `owner_id`, add `visibility` column
- [x] Create `collection_access` table for sharing (invited_identity, user_id, access_level)
- [x] Create identity claiming trigger (auto-populate `user_id` on signup)
- [x] Enable Row-Level Security (RLS) on all tables

### Phase 8.2: RLS Policies ✅ COMPLETE
- [x] **Items**: Public read, authenticated insert (global librarian pattern)
- [x] **Collections**: Read based on visibility + ownership + shared access
- [x] **Collections**: Write only by owner
- [x] **Collection Items**: Inherit parent collection permissions
- [x] **Collection Items**: Write by owner or editors
- [x] **Collection Access**: Owner can grant/revoke, invitees can view
- [x] **Profiles**: Users can read/update their own profile only

### Phase 8.3: Supabase Client Configuration ✅ COMPLETE
- [x] Update `lib/supabase.ts` with persistent session config
- [x] Enable `autoRefreshToken: true`
- [x] Enable `persistSession: true` with localStorage
- [x] Enable `detectSessionInUrl: true` for OAuth callbacks

### Phase 8.4: Authentication UI ✅ COMPLETE
- [x] Update `/add` page with auth state checking
- [x] Create `SignInView` component with Google OAuth button
- [x] Implement `redirectTo` parameter to preserve URL across OAuth redirect
- [x] Auto-resume extraction after successful authentication
- [x] Add loading state during auth check
- [x] Add auth state listener for real-time session updates

### Phase 8.5: Multi-User API Updates ✅ COMPLETE
- [x] Update `lib/inbox.ts` to use `owner_id` and filter by current user
- [x] Update collection creation to set `owner_id` to current user
- [x] Update TypeScript types in `types/database.ts` for new schema
- [x] Add TODO comments for server-side auth context (future improvement)

### Phase 8.6: Documentation ✅ COMPLETE
- [x] Create `AUTH_SHARING.md` with comprehensive design and roadmap
- [x] Document 3-tier data architecture (Librarian, Context, Sharing)
- [x] Document RLS policy patterns and security best practices
- [x] Document OAuth redirect flow and session management
- [x] Document identity claiming mechanism
- [x] Document future phases (SMS auth, temporary sharing, pricing)
- [x] Update `PROJECT.md` to reference auth documentation
- [x] Update `TODO.md` with Phase 8 checklist

### Phase 8.7: Setup & Testing ✅ COMPLETE
- [x] Run migrations on Supabase database (004-013)
- [x] Configure Google OAuth in Supabase dashboard
- [x] Test authentication flow (sign in, profile creation, session persistence)
- [x] Test RLS policies (data isolation verified)
- [x] Deploy to production

## Phase 9: AI Collection Overviews ✅ COMPLETE
- [x] Create `/api/collections/[id]/overview` endpoint
- [x] Implement lazy-loaded AI generation with caching
- [x] Thematic analysis and strategic insights
- [x] Condensed-by-default UX with expand toggle
- [x] Cache in `collection_overviews` table

## Phase 10: Item Attributes System ✅ COMPLETE
- [x] Create `item_attributes` table with normalization
- [x] Support direct, computed, and semantic attribute types
- [x] Generate attributes during extraction
- [x] `/api/items/[id]/attributes` endpoint
- [x] `/api/admin/backfill-attributes` for existing items

## Phase 11: Dynamic AI-Powered Filters ✅ COMPLETE
- [x] Create `collection_attribute_schemas` table
- [x] Implement filter discovery with usefulness scoring
- [x] `/api/collections/[id]/attribute-schemas` endpoint
- [x] Per-collection filter visibility preferences
- [x] Settings panel for filter management
- [x] Filter by attribute values via `/api/collections/[id]/items/by-attribute`

## Phase 12: Security Hardening ✅ COMPLETE
- [x] Full security audit completed
- [x] Fixed authorization bypass vulnerabilities
- [x] Implemented SECURITY DEFINER functions
- [x] Resolved RLS infinite recursion issues
- [x] Session management improvements
- [x] Documentation in SECURITY_FIXES_COMPLETE.md (archived)

## Phase 13: Connection Filters ✅ COMPLETE
- [x] AI-powered connection filtering
- [x] Customizable filter visibility
- [x] Filter preferences persistence

## Known Issues
- Some sites (REI, B&H Photo) fail extraction - JS-heavy pages
- Amazon extraction works but often misses price data
- Jina AI reader may return 404/502 for some valid URLs

## Ideas for Later
- Photo upload
- Bulk import from Amazon
- Price tracking alerts
- Collection sharing UI (backend complete)
- Native iOS app

## Documentation
- [[PROJECT]] - Vision and roadmap
- [[AUTH_SHARING]] - Authentication architecture
- [[STACK]] - Technical stack details