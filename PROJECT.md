# Trove - Personal Knowledge Graph for AI

## Vision
Personal collections (wishlists, inventories, research) that become persistent context for AI agents.

## Current Goal: POC
Validate that the core loop works:
1. Effortless capture (iPhone share sheet)
2. AI-powered extraction (no manual data entry)
3. Useful visualization
4. AI-ready export

## Status: Active Development

### What's Built

**Core Features (All Complete)**
1. **Smart Capture Flow**
   - Context-first UX: add notes while AI extracts
   - Deep link handler at /add?url=
   - AI-powered extraction via Jina + Claude
   - Duplicate detection and handling
   - Mobile-optimized for iPhone share sheet

2. **Collections & Visualization**
   - Grid/list view toggle with persistence
   - Drag-and-drop reordering
   - AI-generated collection overviews with thematic insights
   - Dynamic AI-powered filters with usefulness scoring
   - Per-collection filter visibility preferences
   - Sort by position, date, price, category
   - Item detail bottom sheets

3. **Item Attributes System**
   - Direct, computed, and semantic attributes
   - Automatic generation during extraction
   - Normalized attribute schemas per collection
   - Filtering by attribute values

4. **Multi-User & Security**
   - Google OAuth authentication
   - Full Row-Level Security (RLS) policies
   - SECURITY DEFINER functions for safe queries
   - Public/private/shared collection visibility
   - Email-based collection sharing invitations

5. **Database Architecture**
   - 13 migrations, many-to-many schema
   - Items can belong to multiple collections
   - Collection-specific notes and position
   - Temporal snapshots for price tracking (foundation)

### API Endpoints (26+)
- Extraction, items CRUD, collections CRUD
- Reordering, user notes, re-extraction
- AI overviews, attribute schemas, filter preferences
- Context export for AI agents

### What's NOT Built Yet
- Native iOS app (PWA + shortcut for now)
- Photo upload (URL only)
- Price tracking alerts
- Bulk import
- Collection sharing UI (backend ready)

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

## Resolved Questions
- **Manual editing?** Yes - item detail sheet supports editing
- **Collection structure?** Many-to-many with junction table metadata
- **Low-quality extractions?** Confidence badges + needs_review flag + re-extraction endpoint
- **Export format?** Markdown + JSON hybrid via /api/v1/collections/[id]/context

## Current Focus
- Phase 5: AI Export polish ("Copy for AI" button)
- Phase 6: iPhone Shortcut installation page
- Phase 7: Performance optimization

## Learnings
- Context-first capture UX (add notes while AI works) is better than blocking extraction
- Many-to-many schema unlocks powerful use cases (same item in multiple collections)
- AI-generated collection overviews provide surprising value
- Dynamic filter discovery helps users explore their data
- SECURITY DEFINER functions solve RLS infinite recursion issues

## Documentation

- [[TODO]] - Phase tracking and task list
- [[AUTH_SHARING]] - Authentication architecture and sharing system
- [[AUTH_SETUP]] - OAuth configuration guide
- [[STACK]] - Technical stack details
- [[DESIGN]] - Design system and UI patterns
- [[DEPLOYMENT]] - Vercel deployment guide