-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (for future)
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamp default now()
);

-- Collections table (like playlists)
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  description text,
  type text, -- 'wishlist', 'inventory', 'research'
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Items table (the products)
create table items (
  id uuid primary key default gen_random_uuid(),

  -- Source
  source_url text unique, -- prevent duplicate URLs
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

  -- Notes
  user_notes text,

  -- Metadata
  confidence_score numeric, -- 0-1 from extraction
  extraction_model text, -- which model version
  last_viewed_at timestamp, -- track staleness for price refresh
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Junction table for many-to-many relationship between items and collections
create table collection_items (
  collection_id uuid references collections(id) on delete cascade,
  item_id uuid references items(id) on delete cascade,

  -- Metadata
  added_at timestamp default now(),
  position integer, -- for manual ordering within collection (nullable for flexibility)
  notes text, -- collection-specific notes (e.g., "gift for kid1" vs "already own")

  -- Composite primary key prevents duplicate entries
  primary key (collection_id, item_id)
);

-- Indexes for performance
create index items_category_idx on items(category);
create index items_tags_idx on items using gin(tags);
create index collections_user_id_idx on collections(user_id);
create index collection_items_item_id_idx on collection_items(item_id);
create index collection_items_collection_id_idx on collection_items(collection_id);
create index collection_items_position_idx on collection_items(collection_id, position);

-- Updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to collections
create trigger update_collections_updated_at
  before update on collections
  for each row
  execute function update_updated_at_column();

-- Apply updated_at trigger to items
create trigger update_items_updated_at
  before update on items
  for each row
  execute function update_updated_at_column();
