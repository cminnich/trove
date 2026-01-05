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
  collection_id uuid references collections(id) on delete cascade,

  -- Source
  source_url text,
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
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Indexes for performance
create index items_collection_id_idx on items(collection_id);
create index items_category_idx on items(category);
create index items_tags_idx on items using gin(tags);
create index collections_user_id_idx on collections(user_id);

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
