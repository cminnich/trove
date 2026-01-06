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

## Phase 3: Deep Link Handler
- [ ] Create /add page
- [ ] Handle URL parameter
- [ ] Show extraction loading state
- [ ] Show extracted data for confirmation
- [ ] Allow selecting multiple collections (checkboxes)
- [ ] Save to database via POST /api/items
- [ ] Success confirmation with collection list

## Phase 4: Collections View
- [ ] Create /collections page
- [ ] List all collections with item counts
- [ ] Create new collection modal
- [ ] View items in a specific collection
- [ ] Show collection-specific notes on items
- [ ] Reorder items within collection (drag-and-drop or position input)
- [ ] Add/remove items from current collection
- [ ] Show which collections each item belongs to
- [ ] Filter by category/tags
- [ ] Sort options (by position, added_at, price, etc.)

## Phase 5: AI Export
- [ ] Add "Copy for AI" button
- [ ] Format collection as structured text
- [ ] Include metadata
- [ ] Test with actual Claude chat
- [ ] Iterate on format

## Phase 6: iPhone Integration
- [ ] Create iOS Shortcut
- [ ] Host shareable link
- [ ] Create /install page with instructions
- [ ] Test end-to-end on iPhone

## Phase 7: Polish
- [ ] Mobile-responsive CSS
- [ ] Loading states
- [ ] Error messages
- [ ] Empty states
- [ ] Basic animations

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