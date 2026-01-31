# Open Trove - Social Collections for the AI Era

**Live at [opentrove.app](https://www.opentrove.app)**

## Vision
A social platform where personal collections become persistent, shareable context for AI agents. Open Trove transforms how people organize, discover, and share curated knowledge in the age of AI.

## Core Principles
1. **Effortless capture** - iPhone share sheet to collection in seconds
2. **AI-powered intelligence** - No manual data entry, smart analysis
3. **Beautiful design** - Terminal Noir aesthetic for focused curation
4. **Open by default** - Public discovery, forking, starring
5. **LLM-ready export** - Collections as persistent AI context

## Status: Production

Open Trove is live and fully functional with active users.

### What's Built

**1. Terminal Noir Design System**
   - Distinctive dark, monospace aesthetic
   - JetBrains Mono typography throughout
   - Open Green (#10b981) accent color
   - Void backgrounds (#050505) for immersion
   - Hard shadows, sharp borders, uppercase headers
   - Mobile-first responsive design

**2. Smart Capture Flow**
   - Context-first UX: add notes while AI extracts
   - Deep link handler at /add?url=
   - AI-powered extraction via Jina + Claude Sonnet 4.5
   - Duplicate detection and handling
   - Mobile-optimized for iPhone share sheet
   - Confidence scoring with visual warnings

**3. Collections & Visualization**
   - Grid/list view toggle with localStorage persistence
   - Drag-and-drop reordering (touch-optimized with @dnd-kit)
   - AI-generated collection overviews with thematic insights
   - Dynamic AI-powered filters with usefulness scoring
   - Per-collection filter visibility preferences
   - Sort by position, date, price, category
   - Item detail bottom sheets with full editing

**4. AI Analysis Modes**
   - **Standard**: Thematic analysis and general insights
   - **Researcher**: Gap analysis with product recommendations
   - **Curator**: Redundancy detection and optimization
   - Vercel AI SDK for structured outputs
   - Cached overviews with auto-invalidation

**5. Social Platform Features**
   - Public collection discovery with search
   - Collection starring (bookmarking)
   - Collection forking (clone and customize)
   - User profiles with usernames
   - Identity management (email, phone)
   - Starred collections tab
   - Fork count display
   - Public/Private/Shared visibility

**6. Item Attributes System**
   - Direct, computed, and semantic attributes
   - Automatic generation during extraction
   - Normalized attribute schemas per collection
   - Filtering by attribute values
   - Backfill tool for existing items

**7. Authentication & Security**
   - Google OAuth via Supabase Auth
   - Full Row-Level Security (RLS) policies
   - SECURITY DEFINER functions to prevent recursion
   - Multi-user with complete data isolation
   - Email-based collection sharing invitations
   - Session persistence with auto-refresh

**8. LLM-Ready Export**
   - Context API at `/api/v1/collections/[id]/context`
   - Markdown + JSON hybrid format
   - Verbosity levels (minimal, standard, full)
   - Filter preference controls
   - Optimized for Claude and other LLMs

**9. Database Architecture**
   - 21+ migrations, many-to-many schema
   - Items belong to multiple collections
   - Collection-specific notes and positions
   - Temporal snapshots for price tracking
   - Normalized attributes with schemas

### API Endpoints (26+)
- Extraction, items CRUD, collections CRUD
- Reordering, user notes, re-extraction
- AI overviews, attribute schemas, filter preferences
- Context export for AI agents

### What's NOT Built Yet
- Native iOS app (PWA + shortcut currently working)
- Photo upload (URL-only currently)
- Price tracking alerts (snapshots table ready)
- Bulk import from Amazon/other sources
- Advanced search across all collections
- Collection analytics and insights
- Mobile app notifications

### Current Focus
- Platform refinement and polish
- User feedback integration
- Performance optimization
- Community growth

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

## Success Metrics

**POC Goals (✅ Achieved):**
- Can save 10 products via shortcut without friction
- Extraction accuracy >80% (title, price, image)
- Collection view is usable on iPhone
- AI export is useful for actual Claude chat

**Platform Goals (In Progress):**
- Active users creating and sharing collections
- Public collections being forked and starred
- AI context exports being used in real workflows
- Community engagement and feedback

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

**UX & Design:**
- Context-first capture UX (add notes while AI works) is better than blocking extraction
- Terminal Noir aesthetic creates strong brand identity and focused experience
- Monospace typography throughout feels distinctive and purposeful
- Dark themes with strategic green accents feel modern and intentional

**Technical Architecture:**
- Many-to-many schema unlocks powerful use cases (same item in multiple collections)
- SECURITY DEFINER functions elegantly solve RLS infinite recursion issues
- Vercel AI SDK simplifies structured outputs from Claude
- SWR + Zustand combination provides excellent state management
- Migration-based schema evolution is critical for production

**AI Features:**
- AI-generated collection overviews provide surprising value
- Multiple AI modes (Standard, Researcher, Curator) unlock different use cases
- Dynamic filter discovery helps users explore their data
- Confidence scoring builds trust in AI extractions

**Social Platform:**
- Public-by-default creates network effects
- Starring and forking drive discovery
- Username management and identity are table stakes for social
- Email invitations work well for private sharing
- Fork counts signal collection quality

## Documentation

- [[TODO]] - Phase tracking and task list
- [[AUTH_SHARING]] - Authentication architecture and sharing system
- [[AUTH_SETUP]] - OAuth configuration guide
- [[STACK]] - Technical stack details
- [[DESIGN]] - Design system and UI patterns
- [[DEPLOYMENT]] - Vercel deployment guide