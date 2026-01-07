# Trove

**Personal Knowledge Graph for AI**

Trove is a proof-of-concept application that transforms personal collections (wishlists, inventories, research) into persistent context for AI agents. Capture products and items effortlessly from your iPhone, extract structured data using AI, and export collections in formats optimized for LLM context windows.

## Vision

Personal collections that become persistent context for AI agents. Effortless capture, AI-powered extraction, useful visualization, and AI-ready export.

## Current Status: POC (Proof of Concept)

This project is in early development. The goal is to validate the core loop:
1. ✅ Effortless capture (iPhone share sheet)
2. 🔄 AI-powered extraction (no manual data entry)
3. 🔄 Useful visualization
4. 🔄 AI-ready export

## Features

### Current (POC Scope)
- **Capture Flow**: Deep link handler for URL-based product capture
- **AI Extraction**: Automatic data extraction using Jina AI + Claude
- **Database**: Supabase-powered storage with flexible schema
- **Collections**: Organize items into collections (like playlists)

### Planned (Not in POC)
- Native iOS app (PWA + shortcut for now)
- Photo upload (URL only for POC)
- Multi-user authentication
- Collection sharing
- Price tracking
- Bulk import

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
  - Model: claude-sonnet-4-20250514
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
├── app/              # Next.js app directory
│   ├── api/          # API routes
│   ├── globals.css   # Global styles
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page
├── lib/              # Utility functions
│   └── supabase.ts   # Supabase client
├── supabase/         # Database migrations
│   └── migrations/
├── types/            # TypeScript types
│   └── database.ts   # Database types
└── scripts/          # Helper scripts
```

### Database Schema

The database uses a **many-to-many relationship** for items and collections:
- **users** - User accounts (for future)
- **collections** - Organize items (like playlists)
- **items** - Products/things with extracted metadata
- **collection_items** - Junction table linking items to collections with metadata (position, notes, added_at)

**Key features:**
- Items can belong to multiple collections (e.g., gift-ideas, inventory, kid1-wishlist)
- Items can exist in zero collections ("inbox" workflow)
- Collection-specific metadata: position (manual ordering), notes (context-specific annotations)

See `supabase/migrations/001_initial_schema.sql` for the full schema.

### API Endpoints

**Extraction:**
- `POST /api/extract` - Extract product data from URL (Jina + Claude)
- `POST /api/items` - Create item from URL and optionally add to collections

**Collections:**
- `GET /api/collections` - List all collections
- `POST /api/collections` - Create a new collection
- `GET /api/collections/[id]` - Get collection details
- `PATCH /api/collections/[id]` - Update collection
- `DELETE /api/collections/[id]` - Delete collection

**Collection Items:**
- `GET /api/collections/[id]/items` - List items in collection (with metadata)
- `POST /api/collections/[id]/items` - Add existing item to collection

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

Trove includes comprehensive test coverage using **Vitest**.

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

- [DEPLOYMENT.md](DEPLOYMENT.md) - **Deployment guide for Vercel (start here for testing)**
- [PROJECT.md](PROJECT.md) - Project vision, goals, and roadmap
- [STACK.md](STACK.md) - Detailed tech stack information
- [SETUP.md](SETUP.md) - Detailed setup instructions
- [TODO.md](TODO.md) - Current tasks and roadmap

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Contributing

This is currently a personal project in early development. Contributions and feedback are welcome!


