# Setup Guide

## Prerequisites

- Node.js 20+
- npm
- Supabase account

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and run in the SQL Editor

## 3. Configure Environment Variables

1. Copy the example env file:
   ```bash
   cp env.example .env.local
   ```

2. Fill in your Supabase credentials (from Project Settings > API):
   - `NEXT_PUBLIC_SUPABASE_URL` - Your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Publishable Key (safe for browser)
   - `SUPABASE_SECRET_KEY` - Secret Key (starts with `sb_secret_...`, server-side only)

3. Add your Anthropic API key:
   - `ANTHROPIC_API_KEY`

## 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Test Database Connection

Visit [http://localhost:3000/api/health](http://localhost:3000/api/health)

You should see:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-..."
}
```

## Troubleshooting

### "Missing env.NEXT_PUBLIC_SUPABASE_URL"

Make sure `.env.local` exists and has all required variables.

### "Database connection failed"

1. Verify Supabase credentials in `.env.local`
2. Check that you ran the migration in Supabase SQL Editor
3. Ensure your Supabase project is active

### TypeScript Errors

Run type checking:
```bash
npm run type-check
```

## Next Steps

See [PROJECT.md](PROJECT.md) for the roadmap and [TODO.md](TODO.md) for current tasks.
