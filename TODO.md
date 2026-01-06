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

## Phase 3: Deep Link Handler - "Shadow Save" (iPhone Share Sheet)
- [ ] Create /add page with mobile-first responsive design
- [ ] Handle URL parameter from iOS Shortcut
- [ ] **Shadow Save**: Immediately save item with "extracting..." status
- [ ] Start extraction in background (non-blocking)
- [ ] Show instant success confirmation ("Saved! Extracting details...")
- [ ] Poll or webhook to update UI when extraction completes
- [ ] Collection selector (checkboxes) - defaults to "Inbox"
- [ ] Handle low confidence items (needs_review flag) with visual indicator
- [ ] Allow quick edit of collection assignments
- [ ] Test full flow: iOS Share Sheet → Instant Save → Background Extraction

## Phase 4: Collections View (Mobile-First)
- [ ] **Mobile-responsive CSS** - Touch-friendly, works on iPhone primarily
- [ ] Create /collections page with card-based layout
- [ ] List all collections with item counts and visual previews
- [ ] Create new collection modal (mobile-optimized)
- [ ] View items in a specific collection
- [ ] Show collection-specific notes on items
- [ ] Reorder items within collection (touch drag-and-drop)
- [ ] Add/remove items from current collection (swipe gestures)
- [ ] Show which collections each item belongs to (tags/badges)
- [ ] Filter by category/tags
- [ ] Sort options (by position, added_at, price, etc.)
- [ ] "Needs Review" section for low confidence items
- [ ] Item staleness indicator (last_viewed_at > 30 days)

## Phase 5: AI Export - "Context Bridge"
- [ ] Add "Copy for AI" button with Markdown + JSON hybrid format
- [ ] Human-readable Markdown with embedded JSON blobs for LLM parsing
- [ ] Include rich metadata (images, prices, attributes, collection notes)
- [ ] Create shareable API endpoint: GET /api/v1/collections/[id]/context
- [ ] Public, read-only endpoint for sharing collections with AI agents
- [ ] Add MCP (Model Context Protocol) compatibility notes
- [ ] Test with actual Claude chat and validate parsing accuracy
- [ ] Add "Share Collection" button that generates public URL

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
- [ ] Add Supabase RLS policies for future multi-user support
- [ ] Performance optimization (image lazy loading, pagination)

## Bugs / Issues
- Some sites (REI, B&H Photo) fail extraction - likely due to JS-heavy pages or complex structures
- Amazon extraction works but often misses price data
- Jina AI reader may return 404 errors for some valid URLs

## Ideas for Later
- Photo upload
- Manual editing of items
- Bulk import from Amazon
- Price tracking
- Duplicate detection
- Collections sharing