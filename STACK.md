# Tech Stack

## Frontend
- **Next.js 15.5.9** (App Router, React 19, patched security vulnerabilities)
- **TypeScript** (strict mode)
- **Tailwind CSS** (utility-first styling)

## Backend
- **Next.js API Routes** (serverless functions)
- **Supabase** (Postgres database + future auth)

## AI/ML
- **Jina AI Reader** - URL to markdown conversion
  - Free tier: no API key needed
  - Rate limits: check docs
  - Endpoint: `https://r.jina.ai/{url}`
  
- **Anthropic Claude** - Data extraction
  - Model: claude-sonnet-4-20250514
  - Cost: ~$0.02 per product
  - API key: required

## Database Schema
```sql
-- Users (for future)
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamp default now()
);

-- Collections (like playlists)
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  name text not null,
  description text,
  type text, -- 'wishlist', 'inventory', 'research'
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Items (the products)
create table items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id),
  
  -- Source
  source_url text, -- indexed but not unique (allows periodic re-extraction)
  raw_markdown text, -- from Jina
  
  -- Extracted (from Claude)
  title text not null,
  brand text,
  price numeric,
  currency text,
  retailer text,
  image_url text,
  category text,
  tags text[],
  
  -- Flexible attributes
  attributes jsonb default '{}',

  -- Metadata
  confidence_score numeric, -- 0-1 from extraction
  extraction_model text, -- which model version
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Indexes
create index items_collection_id_idx on items(collection_id);
create index items_category_idx on items(category);
create index items_tags_idx on items using gin(tags);
```

## Environment Variables
```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...

# Supabase (from Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Publishable Key (safe for browser)
SUPABASE_SECRET_KEY=sb_secret_...     # Secret Key (server-side only)
```

## Dependencies
```json
{
  "dependencies": {
    "next": "^15.5.9",
    "react": "^19",
    "react-dom": "^19",
    "@supabase/supabase-js": "^2.39.0",
    "@anthropic-ai/sdk": "^0.32.1",
    "zod": "^3.22.4",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^9.0.1",
    "@dnd-kit/utilities": "^3.2.2",
    "swr": "^2.2.7",
    "zustand": "^5.0.3",
    "lucide-react": "^0.469.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

**Phase 4 Dependencies:**
- **@dnd-kit** - Touch-optimized drag-and-drop library (core, sortable, utilities)
- **swr** - Server state management with caching and revalidation
- **zustand** - Lightweight client state management for UI state
- **lucide-react** - Icon library for UI components

## Deployment
- **Hosting**: Vercel (free tier)
- **Database**: Supabase (free tier)
- **Domain**: TBD (trove.app?)

## Testing

### Playwright (Browser Automation)
- **MCP Integration** - Playwright tools available via Claude Code MCP server
- **Usage**: Default testing approach for all UI features and user flows
- **When to use**:
  - Validating capture flow (/add page)
  - Testing extraction results display
  - Verifying responsive layouts
  - Testing collection views and interactions
  - Validating form submissions and API responses
- **Requires**: Dev server running (`npm run dev`)
- **Access**: Claude Code can use Playwright tools directly (no setup needed)

### Vitest (Unit/Integration Tests)
- Unit tests for schemas, utilities, business logic
- Integration tests for API endpoints
- See `tests/README.md` for details

## Development
```bash
npm run dev         # Start dev server (localhost:3000)
npm run build       # Production build
npm run type-check  # TypeScript validation

# Testing
npm run test        # Unit tests (Vitest)
npm run test:watch  # Auto-rerun tests on file changes
# Playwright: Available via Claude Code MCP (no separate command)
```

## API Patterns

### Extraction Flow
```
1. User shares URL via shortcut
2. Deep link opens: /add?url={encoded_url}
3. Frontend calls: POST /api/extract
4. Server fetches markdown from Jina
5. Server sends to Claude for extraction
6. Returns structured JSON
7. Frontend shows confirmation UI
8. User saves to collection
```

### Error Handling
- Always try/catch async operations
- Log errors to console (we'll add Sentry later)
- Return user-friendly messages
- Store partial data when extraction fails

## Performance Targets (POC)
- Extraction: <5 seconds
- Page load: <2 seconds on 4G
- Database queries: <100ms

## Security (Later)
- For POC: no auth, single user
- For MVP: Supabase RLS policies
- For production: Row-level security, API rate limiting