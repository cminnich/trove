# Migration 002: Many-to-Many Items-Collections Relationship

## What Changed

This migration updates the database schema from a one-to-many to a many-to-many relationship between items and collections.

### Changes:
1. **Removed** `collection_id` foreign key from `items` table
2. **Added** new `collection_items` junction table with metadata (`added_at`, `position`, `notes`)
3. **Updated** indexes to support the new relationship

## How to Apply (Supabase Cloud)

Since this is a destructive migration that changes the table structure, follow these steps:

### Option 1: Fresh Start (Recommended for POC)

If you have no production data, the easiest approach is to recreate the tables:

1. **Go to Supabase SQL Editor** ([supabase.com](https://supabase.com))

2. **Drop existing tables**:
   ```sql
   -- Drop existing tables (this will delete all data!)
   DROP TABLE IF EXISTS collection_items CASCADE;
   DROP TABLE IF EXISTS items CASCADE;
   DROP TABLE IF EXISTS collections CASCADE;
   DROP TABLE IF EXISTS users CASCADE;
   DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
   ```

3. **Re-apply the migration**:
   - Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and run in the SQL Editor

4. **Verify tables were created**:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```

   You should see:
   - `collection_items` (new!)
   - `collections`
   - `items`
   - `users`

### Option 2: Preserve Data (If you have production data)

If you need to preserve existing data:

1. **Export existing data** (if you have items with collection_id):
   ```sql
   SELECT * FROM items WHERE collection_id IS NOT NULL;
   ```

2. **Apply the schema changes**:
   ```sql
   -- Create junction table first
   CREATE TABLE collection_items (
     collection_id uuid references collections(id) on delete cascade,
     item_id uuid references items(id) on delete cascade,
     added_at timestamp default now(),
     position integer,
     notes text,
     primary key (collection_id, item_id)
   );

   -- Migrate existing data to junction table
   INSERT INTO collection_items (collection_id, item_id, added_at)
   SELECT collection_id, id, created_at
   FROM items
   WHERE collection_id IS NOT NULL;

   -- Drop the old foreign key
   ALTER TABLE items DROP COLUMN collection_id;

   -- Add indexes
   CREATE INDEX collection_items_item_id_idx ON collection_items(item_id);
   CREATE INDEX collection_items_collection_id_idx ON collection_items(collection_id);
   CREATE INDEX collection_items_position_idx ON collection_items(collection_id, position);
   ```

## Verification

After applying the migration, verify the schema:

```sql
-- Check items table (should NOT have collection_id)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'items'
ORDER BY ordinal_position;

-- Check collection_items table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'collection_items'
ORDER BY ordinal_position;
```

Expected `collection_items` columns:
- `collection_id` (uuid)
- `item_id` (uuid)
- `added_at` (timestamp)
- `position` (integer)
- `notes` (text)

## Testing the New Schema

Create a test collection and item:

```sql
-- Create a test collection
INSERT INTO collections (name, description, type)
VALUES ('Test Collection', 'A test collection', 'wishlist')
RETURNING id;

-- Create a test item
INSERT INTO items (title, brand, price, currency, retailer)
VALUES ('Test Product', 'Test Brand', 99.99, 'USD', 'Test Retailer')
RETURNING id;

-- Add item to collection (use actual IDs from above)
INSERT INTO collection_items (collection_id, item_id, position, notes)
VALUES (
  '<collection-id-from-above>',
  '<item-id-from-above>',
  0,
  'This is a test note'
);

-- Query items in collection
SELECT i.*, ci.added_at, ci.position, ci.notes
FROM items i
JOIN collection_items ci ON i.id = ci.item_id
WHERE ci.collection_id = '<collection-id>';
```

## Rollback (If Needed)

To rollback to the previous schema:

```sql
-- Add collection_id back to items
ALTER TABLE items ADD COLUMN collection_id uuid REFERENCES collections(id) ON DELETE CASCADE;

-- Migrate data back (takes first collection if item in multiple)
UPDATE items
SET collection_id = ci.collection_id
FROM (
  SELECT DISTINCT ON (item_id) item_id, collection_id
  FROM collection_items
  ORDER BY item_id, added_at ASC
) ci
WHERE items.id = ci.item_id;

-- Drop junction table
DROP TABLE collection_items CASCADE;

-- Recreate index
CREATE INDEX items_collection_id_idx ON items(collection_id);
```

⚠️  **Warning:** Rollback will lose data if items were in multiple collections!
