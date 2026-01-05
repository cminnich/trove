# Database Setup

## Quick Start

1. **Create a Supabase project** at https://supabase.com
2. **Run the migration** in the SQL Editor:
   - Copy contents of `migrations/001_initial_schema.sql`
   - Paste into Supabase SQL Editor
   - Run the query
3. **Get your credentials** from Project Settings > API:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Publishable Key
   - `SUPABASE_SECRET_KEY` - Secret Key (starts with `sb_secret_...`)
4. **Create `.env.local`** in project root:
   ```bash
   cp .env.example .env.local
   # Fill in your actual values
   ```

## Schema Overview

- **users** - User accounts (for future multi-user support)
- **collections** - Groups of items (wishlists, inventories, research)
- **items** - Products/things captured from URLs

## Migrations

Manual migrations for POC. Production would use Supabase CLI or automated migrations.

## Useful Supabase SQL Queries

```sql
-- Check tables
select * from information_schema.tables where table_schema = 'public';

-- Count items
select count(*) from items;

-- Recent items
select title, retailer, price, created_at from items order by created_at desc limit 10;

-- Collections with item counts
select c.name, count(i.id) as item_count
from collections c
left join items i on i.collection_id = c.id
group by c.id, c.name;
```
