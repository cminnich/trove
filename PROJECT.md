# Trove - Personal Knowledge Graph for AI

## Vision
Personal collections (wishlists, inventories, research) that become persistent context for AI agents.

## Current Goal: POC
Validate that the core loop works:
1. Effortless capture (iPhone share sheet)
2. AI-powered extraction (no manual data entry)
3. Useful visualization
4. AI-ready export

## Status: Not Started

### What Exists
- Nothing yet, starting fresh

### What We're Building (POC Scope)
1. **Capture Flow**
   - Deep link handler at /add?url=
   - Extracts product data via Jina + Claude
   - Saves to Supabase
   - Confirmation UI

2. **Database Schema**
   - users table
   - collections table (like playlists)
   - items table (the products/things)
   - Flexible schema for different item types

3. **Visualization**
   - List view of collections
   - Grid view of items in collection
   - Filter by category/tags
   - Sort by date added, price, etc.

4. **AI Export**
   - "Copy for AI" button
   - Formats collection as structured text
   - Optimized for LLM context windows
   - Include metadata (dates, prices, notes)

### What We're NOT Building Yet
- Native iOS app (just PWA + shortcut)
- Photo upload (URL only for POC)
- Auth/multi-user (single user - you)
- Sharing collections
- Price tracking
- Bulk import
- Mobile app polish

## Tech Decisions

### Why Next.js?
- Server components = simple mental model
- API routes built-in
- Easy deployment (Vercel)
- You know it

### Why Supabase?
- Postgres (real database, not toy)
- Auth ready when we need it
- Free tier is generous
- Great DX with TypeScript

### Why Claude API?
- Best for extraction tasks
- Structured outputs
- Reasonable pricing
- We trust it

### Why Jina AI?
- Free tier sufficient for POC
- No API key needed initially
- Clean markdown output
- Fast

## Architecture: Many-to-Many as Contextual Knowledge Engine

The `collection_items` junction table is where items gain contextual meaning:
- Same watch can be in "My Collection" (note: "daily driver") AND "Gift Ideas" (note: "for Dad")
- Position allows manual ordering per collection
- Notes are collection-specific, not global to the item

### 4-Tier Data Hierarchy
| Tier | Field | Location | Purpose |
|------|-------|----------|---------|
| 1. Librarian | `item_type` | items table | System anchor for AI reasoning |
| 2. Department | `category` | items table | Retail-level metadata |
| 3. Traits | `tags` | items table | Item-level descriptors |
| 4. Context | `collections` | junction table | Organizational playlists |

**Key Insight**: Objective facts (what it is) live on the item. Subjective context (why you saved it, where it fits) lives on the junction table.

This separation enables AI reasoning like:
- "What watches do I own?" → filter by collection
- "What's similar to this watch?" → compare item attributes
- "Why did I save this?" → read collection-specific notes

## Success Metrics (POC)
- Can save 10 products via shortcut without friction
- Extraction accuracy >80% (title, price, image)
- Collection view is usable on iPhone
- AI export is useful for actual Claude chat

## Timeline
- Week 1: Database + extraction working
- Week 2: Visualization + export
- Week 3: Polish + test with Shannon

## Open Questions
- Do we need manual editing of extracted data?
- What's the right collection structure? (tags vs categories vs both?)
- How do we handle items that don't extract well?
- What's minimum viable export format?

## Learnings (will update as we go)
- TBD

## Next Steps (see TODO.md)