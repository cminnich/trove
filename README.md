# Trove

**Personal Knowledge Graph for AI**

Trove is a proof-of-concept application that transforms personal collections (wishlists, inventories, research) into persistent context for AI agents. Capture products and items effortlessly from your iPhone, extract structured data using AI, and export collections in formats optimized for LLM context windows.

## Vision

Personal collections that become persistent context for AI agents. Effortless capture, AI-powered extraction, useful visualization, and AI-ready export.

## Current Status: Active Development

The core POC loop is complete and working:
1. ✅ Effortless capture (iPhone share sheet via deep link)
2. ✅ AI-powered extraction (Jina + Claude, no manual data entry)
3. ✅ Useful visualization (grid/list views, sorting, filtering)
4. ✅ AI-ready export (context endpoint for LLM consumption)

## Features

### Current
- **Smart Capture Flow**: Context-first UX - add notes while AI extracts in background
- **AI Extraction**: Automatic data extraction using Jina AI + Claude
- **Collections**: Grid/list views, drag-and-drop reordering, sorting options
- **AI Collection Overviews**: Thematic analysis and strategic insights per collection
- **Dynamic Filters**: AI-discovered filters with usefulness scoring
- **Item Attributes**: Direct, computed, and semantic attributes with schema normalization
- **Multi-user Authentication**: Google OAuth with session persistence
- **Row-Level Security**: Full RLS policies with SECURITY DEFINER functions
- **Collection Sharing**: Email-based invitations with viewer/editor permissions
- **Public/Private Collections**: Visibility controls per collection

### Planned
- Native iOS app (PWA + shortcut for now)
- Photo upload (URL only currently)
- Price tracking alerts
- Bulk import
- Collection sharing UI (backend ready)

## Tech Stack

### Frontend
- **Next.js 15.5.9** (App Router, React 19)
- **TypeScript** (strict mode)
- **Tailwind CSS** (utility-first styling)

### Backend
- **Next.js API Routes** (serverless functions)
- **Supabase** (Postgres database + future auth)

### AI/ML
- **Jina AI Reader** - URL to markdown conversion
  - Free tier: no API key needed
  - Endpoint: `https://r.jina.ai/{url}`
  
- **Anthropic Claude** - Data extraction
  - Model: claude-sonnet-4-5-20250929
  - Cost: ~$0.02 per product

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Supabase account
- Anthropic API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/cminnich/trove.git
   cd trove
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to the SQL Editor
   - Copy the contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and run in the SQL Editor

4. **Configure environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Fill in your credentials in `.env.local`:
   ```bash
   # Anthropic API
   ANTHROPIC_API_KEY=sk-ant-...
   
   # Supabase (from Project Settings > API)
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Publishable Key
   SUPABASE_SECRET_KEY=sb_secret_...     # Secret Key (server-side only)
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

6. **Test database connection**
   
   Visit [http://localhost:3000/api/health](http://localhost:3000/api/health)
   
   You should see:
   ```json
   {
     "status": "ok",
     "database": "connected",
     "timestamp": "2024-..."
   }
   ```

## Development

### Available Scripts

```bash
npm run dev         # Start dev server (localhost:3000)
npm run build       # Production build
npm run start       # Start production server
npm run lint        # Run ESLint
npm run type-check  # TypeScript validation
npm run test        # Run all tests
npm run test:watch  # Run tests in watch mode
npm run test:ui     # Run tests with UI
```

### Project Structure

```
trove/
├── app/                    # Next.js app directory
│   ├── api/                # API routes (26+ endpoints)
│   │   ├── items/          # Items CRUD, attributes, re-extract
│   │   ├── collections/    # Collections, items, overviews, filters
│   │   └── v1/             # Versioned public API (context export)
│   ├── add/                # Smart capture page
│   ├── collections/        # Collection views
│   ├── components/         # Shared React components
│   ├── globals.css         # Global styles + design system
│   └── layout.tsx          # Root layout with auth
├── lib/                    # Utility functions
│   ├── supabase-client.ts  # Browser client
│   ├── supabase-server.ts  # Server client + service role
│   └── inbox.ts            # Inbox collection helper
├── prompts/                # AI prompts
│   └── extraction.txt      # Claude extraction prompt
├── supabase/               # Database
│   └── migrations/         # 13 migration files
├── types/                  # TypeScript types
│   ├── database.ts         # Supabase generated types
│   └── capture.ts          # Capture flow types
└── tests/                  # Vitest tests
```

### Database Schema

The database uses 13 migrations with many-to-many relationships:

**Core Tables:**
- **profiles** - User profiles (synced from Supabase Auth)
- **items** - Products/things with extracted metadata
- **collections** - Organize items with visibility controls (public/private/shared)
- **collection_items** - Junction table with position, notes, added_at

**AI Features:**
- **collection_overviews** - Cached AI-generated collection summaries
- **item_attributes** - Normalized attributes (direct, computed, semantic)
- **collection_attribute_schemas** - Discovered filters with usefulness scoring
- **collection_filter_preferences** - Per-user filter visibility settings

**Sharing & Access:**
- **collection_access** - Sharing invitations and permissions
- **item_snapshots** - Price/availability history (temporal tracking)

**Key features:**
- Items can belong to multiple collections
- Collection-specific metadata (position, notes)
- Full Row-Level Security (RLS) with SECURITY DEFINER functions
- Identity claiming for pre-signup invitations

See `supabase/migrations/` for all schema definitions (001-013).

### API Endpoints (26+)

**Extraction & Items:**
- `POST /api/extract` - Extract product data from URL (Jina + Claude)
- `POST /api/items` - Create item from URL and optionally add to collections
- `GET /api/items/[id]` - Get item details
- `PATCH /api/items/[id]` - Update item
- `DELETE /api/items/[id]` - Delete item
- `POST /api/items/[id]/re-extract` - Re-extract item data from source
- `GET /api/items/recent` - Get recently added items
- `GET /api/items/[id]/snapshots` - Get price/availability history
- `GET /api/items/[id]/attributes` - Get item attributes
- `GET/PATCH /api/items/[id]/user-notes` - Manage user notes per item
- `GET/PATCH /api/items/[id]/user-collections` - Manage item's collections

**Collections:**
- `GET /api/collections` - List all collections
- `POST /api/collections` - Create a new collection
- `GET /api/collections/[id]` - Get collection details
- `PATCH /api/collections/[id]` - Update collection
- `DELETE /api/collections/[id]` - Delete collection
- `GET /api/collections/[id]/overview` - AI-generated collection overview
- `GET /api/collections/[id]/attribute-schemas` - Discovered filter schemas
- `GET/PATCH /api/collections/[id]/filter-preferences` - Filter visibility settings

**Collection Items:**
- `GET /api/collections/[id]/items` - List items in collection
- `POST /api/collections/[id]/items` - Add item to collection
- `DELETE /api/collections/[id]/items/[itemId]` - Remove item from collection
- `POST /api/collections/[id]/items/reorder` - Reorder items
- `GET /api/collections/[id]/items/by-attribute` - Filter by attribute

**AI Context Export:**
- `GET /api/v1/collections/[id]/context` - Export collection for LLM consumption

**Utilities:**
- `GET /api/health` - Health check
- `GET /api/categories` - List categories
- `GET /api/tags` - List tags
- `GET/PATCH /api/user/preferences` - User preferences
- `POST /api/admin/backfill-attributes` - Backfill attributes for existing items

### Capture Flow

```
1. User shares URL via shortcut
2. Deep link opens: /add?url={encoded_url}
3. Frontend calls: POST /api/items with URL + collection IDs
4. Server calls /api/extract internally (Jina + Claude)
5. Server saves item to database
6. Server adds item to specified collections with metadata
7. Returns item data + collection assignments
8. Frontend shows success confirmation
```

### Testing

Trove uses a **multi-layered testing approach** with Playwright as the default for UI validation.

#### Playwright (Browser Automation) - **Default for UI Testing**

**MCP Integration**: Available directly through Claude Code via Playwright MCP server.

**Usage Pattern:**
1. Start dev server: `npm run dev`
2. Claude Code uses Playwright tools to:
   - Navigate to pages (`/add`, `/collections`)
   - Take snapshots and screenshots
   - Click buttons, fill forms, test interactions
   - Verify responsive layouts
   - Validate extraction results display
   - Test complete user flows

**When to use Playwright:**
- ✅ Any UI feature or component
- ✅ User flows (capture → extract → save)
- ✅ Form validation and submission
- ✅ Responsive layout verification
- ✅ Visual regression testing

**Example test scenarios:**
- Capture flow: Load /add?url=... → verify extraction → save to collection
- Collections view: List items → filter by category → verify display
- Responsive: Resize viewport to 375x667 → verify mobile layout

#### Vitest (Unit/Integration Tests)

**Quick start:**
```bash
npm run test        # Run all tests (unit tests)
npm run test:watch  # Auto-rerun tests on file changes
```

**Test types:**
- **Unit tests** - Schema validation, business logic (no external dependencies)
- **Integration tests** - API endpoint testing (requires dev server + API keys)

**Run integration tests:**
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run test tests/integration
```

See [tests/README.md](tests/README.md) for comprehensive testing documentation.

**Current test coverage:**
- ✅ 18 schema validation tests (ProductExtractionSchema)
- ✅ 9 API integration tests (/api/extract endpoint)
- 📝 Items CRUD tests (planned)
- 📝 Collections CRUD tests (planned)

#### Testing Philosophy

**Default to Playwright** for any feature involving UI, user interaction, or visual verification. Use Vitest for pure logic, schemas, and API contracts. Playwright provides the most value for a UI-heavy application like Trove.

## Success Metrics (POC)

- Can save 10 products via shortcut without friction
- Extraction accuracy >80% (title, price, image)
- Collection view is usable on iPhone
- AI export is useful for actual Claude chat

## Deployment

Trove is optimized for deployment on **Vercel** (Next.js's native platform).

**Quick Deploy:**
1. Push to GitHub
2. Import to Vercel
3. Add environment variables (Anthropic API, Supabase)
4. Deploy in one click

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide, including:
- One-click Vercel deployment
- Environment variables setup
- iOS Shortcut configuration for testing
- Monitoring and debugging
- Cost estimation

## Documentation

- [[PROJECT]] - Vision and strategic roadmap
- [[TODO]] - Phase tracking and task list
- [[STACK]] - Technical stack details
- [[DESIGN]] - Design system and UI patterns
- [[AUTH_SHARING]] - Authentication architecture
- [[AUTH_SETUP]] - OAuth configuration guide
- [[DEPLOYMENT]] - Vercel deployment guide
- [[SETUP]] - Local development setup

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Contributing

This is currently a personal project in early development. Contributions and feedback are welcome!


