# Master Prompt: AI-Powered Connections & Enhanced Item Details

**Purpose:** This document captures the valuable concepts from the meditative-capture experiment branch, allowing you to implement these features from a clean main branch without the spatial Galaxy metaphor.

**What to implement:**
1. AI-Powered Connections (semantic attribute grouping)
2. Enhanced Item Details with swipe navigation
3. Connection-based filtering in item details

**What was discarded:**
- Galaxy spatial metaphor and coordinate systems
- Socratic dialogue / question generation
- Meditative capture flow phases
- Nebula/Seed visual concepts

---

## Context: Trove Application

Trove is a personal curation app for saving items from the web. Core entities:
- **Items**: Products, articles, links saved from URLs with AI-extracted metadata
- **Collections**: User-created groups of items (inventory, wishlist, research, etc.)
- **Collection Items**: Junction table linking items to collections (many-to-many)

Current tech stack:
- Next.js 14 (App Router)
- Supabase (PostgreSQL + Auth)
- TypeScript
- Framer Motion for animations
- Tailwind CSS

Key existing files:
- `app/collections/[id]/page.tsx` - Collection detail view
- `app/collections/components/ItemDetailSheet.tsx` - Current item detail bottom sheet
- `app/components/BottomSheet.tsx` - Reusable bottom sheet component
- `types/database.ts` - Supabase generated types
- `app/api/items/[id]/route.ts` - Item CRUD endpoints

---

## Part 1: AI-Powered Connections Architecture

### Concept

"Connections" are AI-detected semantic attributes that enable grouping and filtering items across collections. Instead of manual tagging, the AI extraction pipeline automatically identifies groupable attributes like price range, brand, color, category, etc.

### Data Model

#### 1. Attribute Schemas (System-Defined Grouping Rules)

```sql
-- System-defined attribute categories that items can be grouped by
CREATE TABLE attribute_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,           -- 'case_size', 'price_range', 'color', 'brand'
  display_name TEXT NOT NULL,         -- 'Case Size', 'Price Range', 'Color'
  unit TEXT,                          -- 'mm', 'USD', null
  grouping_type TEXT NOT NULL,        -- 'range', 'discrete', 'color'
  grouping_config JSONB,              -- { "ranges": [[0,34], [35,38], [39,42], [43,999]] }
  applicable_item_types TEXT[],       -- ['watch', 'jewelry'] or null for all
  extraction_priority INT DEFAULT 0,  -- Higher = more likely to extract
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example data:
-- key: 'price_range', grouping_type: 'range', grouping_config: { "ranges": [[0,100], [100,500], [500,1000], [1000,5000], [5000,999999]] }
-- key: 'brand', grouping_type: 'discrete'
-- key: 'color', grouping_type: 'color'
-- key: 'case_size', grouping_type: 'range', grouping_config: { "ranges": [[0,34], [35,38], [39,42], [43,999]] }, applicable_item_types: ['watch']
```

#### 2. Item Attributes (AI-Extracted Values)

```sql
-- AI-extracted attribute values per item
CREATE TABLE item_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  schema_id UUID REFERENCES attribute_schemas(id),
  raw_value TEXT,                     -- '38' (as extracted from page)
  normalized_value JSONB,             -- { "value": 38, "unit": "mm" }
  group_key TEXT,                     -- '35-38mm' (computed from schema ranges)
  confidence FLOAT,                   -- How confident the AI was in extraction
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, schema_id)
);

-- Indexes for fast grouping queries
CREATE INDEX item_attributes_group_key_idx ON item_attributes(schema_id, group_key);
CREATE INDEX item_attributes_item_idx ON item_attributes(item_id);
```

#### 3. User Pinned Connections (Which Attributes to Show)

```sql
-- User's preferred connection modes for visualization/filtering
CREATE TABLE user_pinned_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_id UUID REFERENCES attribute_schemas(id),
  is_active BOOLEAN DEFAULT true,     -- Currently showing in filters
  display_order INT,
  pinned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, schema_id)
);
```

### Grouping Logic

When computing groups for a connection mode:

```typescript
interface ConnectionGroup {
  schemaId: string;
  groupKey: string;           // '35-38mm', 'Rolex', '$500-1000'
  displayName: string;        // '35-38mm', 'Rolex', '$500 - $1,000'
  itemCount: number;
  itemIds: string[];
}

// Query: Get all groups for a given attribute schema
async function getConnectionGroups(schemaId: string, userId: string): Promise<ConnectionGroup[]> {
  const { data } = await supabase
    .from('item_attributes')
    .select(`
      group_key,
      item_id,
      items!inner(
        collection_items!inner(
          collections!inner(user_id)
        )
      )
    `)
    .eq('schema_id', schemaId)
    .eq('items.collection_items.collections.user_id', userId)
    .not('group_key', 'is', null);

  // Aggregate by group_key
  const groups = new Map<string, string[]>();
  data?.forEach(row => {
    const existing = groups.get(row.group_key) || [];
    existing.push(row.item_id);
    groups.set(row.group_key, existing);
  });

  return Array.from(groups.entries()).map(([key, ids]) => ({
    schemaId,
    groupKey: key,
    displayName: formatGroupKey(key), // '$500-1000' -> '$500 - $1,000'
    itemCount: ids.length,
    itemIds: [...new Set(ids)],
  }));
}
```

### Extraction Pipeline Update

Modify the AI extraction prompt to extract semantic attributes:

```typescript
// In extraction prompt, add:
const attributeExtractionPrompt = `
Also extract these semantic attributes if present:
- price_range: The price (number and currency)
- brand: The brand or manufacturer name
- color: Primary color(s)
- category: Product category (watch, bag, shoe, etc.)
- material: Primary material
- size: Size specification (if applicable to item type)

Return attributes as:
"attributes": {
  "price": { "value": 599, "currency": "USD" },
  "brand": "Omega",
  "color": ["black", "silver"],
  "category": "watch",
  "case_size": { "value": 38, "unit": "mm" }
}
`;
```

### API Endpoints

```typescript
// GET /api/attributes/schemas
// Returns all available attribute schemas

// GET /api/items/:id/attributes
// Returns extracted attributes for an item

// GET /api/connections/:schemaId/groups
// Returns all groups with item counts for a schema

// POST /api/user/connections
// Pin/unpin a connection mode for the current user
// Body: { schemaId, isActive }

// GET /api/user/connections
// Get user's pinned connection modes
```

### Initial Attribute Schemas to Seed

```sql
INSERT INTO attribute_schemas (key, display_name, grouping_type, grouping_config, extraction_priority) VALUES
  ('price_range', 'Price Range', 'range', '{"ranges": [[0,100], [100,500], [500,1000], [1000,5000], [5000,999999]], "labels": ["Under $100", "$100-500", "$500-1,000", "$1,000-5,000", "$5,000+"]}', 10),
  ('brand', 'Brand', 'discrete', NULL, 9),
  ('color', 'Color', 'discrete', NULL, 7),
  ('category', 'Category', 'discrete', NULL, 8),
  ('retailer', 'Retailer', 'discrete', NULL, 6),
  ('year', 'Year', 'range', '{"ranges": [[1900,1970], [1970,1990], [1990,2000], [2000,2010], [2010,2020], [2020,2030]]}', 5);
```

---

## Part 2: Enhanced Item Details with Swipe Navigation

### Concept

Transform the current `ItemDetailSheet` into a full-screen immersive view that supports swiping left/right to navigate between items in the same collection. The view should feel fluid with parallax effects and smooth transitions.

### Requirements

#### 2.1 Full-Screen Item Detail View

Replace the bottom sheet with a full-screen modal/page:

Note: this mockup screen is missing some key additional item details (core attributes on the Item itself, any User-entered note) - the full functionality provided by the current item details bottom sheet should still be a subset of the full functionality on this page. The layout presented below is simply an idea/suggestion on some layout aspects.

```
┌─────────────────────────────────────────────────┐
│  [←]                              [Collection]  │  ← Header: back button, collection name
│                                                 │
│                                                 │
│            ┌─────────────────┐                  │
│            │                 │                  │
│            │   Item Image    │ ← Large, centered│
│            │                 │     with subtle float
│            └─────────────────┘                  │
│                                                 │
│         Title / Brand / Price                   │  ← Key metadata
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ ○──○──●──○──○                             │  │  ← Position indicator (dots)
│  │ Item 3 of 12                              │  │     showing current item in sequence
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ [All] [Price] [Brand] [Color] [Category] │    │  ← Connection filter chips
│  └─────────────────────────────────────────┘    │     (horizontal scroll)
│                                                 │
│            ↔ Swipe to navigate                  │  ← Gesture hint (fades after first swipe)
└─────────────────────────────────────────────────┘
```

#### 2.2 Swipe Navigation

- **Swipe left**: Go to next item in sequence
- **Swipe right**: Go to previous item in sequence
- **Sequence source**: By default, all items in the current collection (sorted by current sort preference)
- **Animation**: Item image slides out, next item slides in with spring physics
- **Parallax**: Background elements (if any) move slower than foreground

```typescript
interface SwipeNavigationProps {
  items: Item[];                    // All items in the navigation sequence
  currentIndex: number;             // Currently viewed item index
  onNavigate: (newIndex: number) => void;
}

// Use Framer Motion's drag gesture:
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  onDragEnd={(event, info) => {
    const threshold = 100; // px
    if (info.offset.x > threshold && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    } else if (info.offset.x < -threshold && currentIndex < items.length - 1) {
      onNavigate(currentIndex + 1);
    }
  }}
>
```

#### 2.3 Position Indicator

Show a dot-based indicator of current position:

```typescript
function PositionIndicator({ total, current }: { total: number; current: number }) {
  // Show max 7 dots, with current always centered when possible
  const visibleCount = Math.min(7, total);
  const halfVisible = Math.floor(visibleCount / 2);

  let startIdx = Math.max(0, current - halfVisible);
  let endIdx = Math.min(total, startIdx + visibleCount);

  // Adjust start if we're near the end
  if (endIdx - startIdx < visibleCount) {
    startIdx = Math.max(0, endIdx - visibleCount);
  }

  return (
    <div className="flex gap-1.5 items-center justify-center">
      {Array.from({ length: endIdx - startIdx }, (_, i) => {
        const idx = startIdx + i;
        const isCurrent = idx === current;
        return (
          <div
            key={idx}
            className={`rounded-full transition-all ${
              isCurrent
                ? 'w-2.5 h-2.5 bg-indigo-500'
                : 'w-1.5 h-1.5 bg-gray-300'
            }`}
          />
        );
      })}
    </div>
  );
}
```

---

## Part 3: Connection-Based Filtering in Item Details

### Concept

When viewing an item, users can tap a Connection chip (e.g., "Same Brand", "Similar Price") to filter the swipe navigation sequence to only items sharing that attribute value.

### Requirements

#### 3.1 Connection Filter Chips

Display horizontally scrollable chips below the item:

```typescript
interface ConnectionChip {
  schemaId: string;
  displayName: string;        // "Brand", "Price Range"
  currentValue: string;       // "Rolex", "$500-1000"
  matchingCount: number;      // How many items share this value
  isActive: boolean;
}

function ConnectionChips({
  item,
  allItems,
  activeFilter,
  onFilterChange
}: {
  item: Item;
  allItems: Item[];
  activeFilter: string | null;  // schemaId or null for "All"
  onFilterChange: (schemaId: string | null) => void;
}) {
  // Build chips from item's attributes
  const chips = useMemo(() => {
    // Get item's attributes from item_attributes table
    // For each attribute, count how many other items share the same group_key
    // Return as chips
  }, [item, allItems]);

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2">
      <button
        onClick={() => onFilterChange(null)}
        className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
          activeFilter === null
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-700'
        }`}
      >
        All ({allItems.length})
      </button>
      {chips.map(chip => (
        <button
          key={chip.schemaId}
          onClick={() => onFilterChange(chip.schemaId)}
          className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
            activeFilter === chip.schemaId
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {chip.displayName}: {chip.currentValue} ({chip.matchingCount})
        </button>
      ))}
    </div>
  );
}
```

#### 3.2 Filtered Navigation

When a filter is active:

```typescript
function useFilteredItems(
  allItems: Item[],
  currentItem: Item,
  activeSchemaId: string | null
): Item[] {
  return useMemo(() => {
    if (!activeSchemaId) return allItems;

    // Get the current item's group_key for this schema
    const currentGroupKey = currentItem.attributes?.[activeSchemaId]?.group_key;
    if (!currentGroupKey) return allItems;

    // Filter to items with the same group_key
    return allItems.filter(item =>
      item.attributes?.[activeSchemaId]?.group_key === currentGroupKey
    );
  }, [allItems, currentItem, activeSchemaId]);
}
```

#### 3.3 Visual Feedback for Filtered Mode

When filtering is active:
- Show the filter name prominently (e.g., "Same Brand: Rolex")
- Position indicator updates to show filtered count
- Swipe hint updates (e.g., "3 items with same brand")

```typescript
{activeFilter && (
  <div className="text-center py-2 bg-indigo-50 dark:bg-indigo-900/20">
    <span className="text-sm text-indigo-600 dark:text-indigo-400">
      Showing {filteredItems.length} items with {getFilterDisplayName(activeFilter)}
    </span>
    <button
      onClick={() => onFilterChange(null)}
      className="ml-2 text-xs underline"
    >
      Clear
    </button>
  </div>
)}
```

---

## Part 4: Implementation Phases

### Phase 1: Database Migration

1. Create `attribute_schemas` table
2. Create `item_attributes` table
3. Create `user_pinned_connections` table
4. Seed initial attribute schemas
5. Add indexes for performance

### Phase 2: Extraction Pipeline Update

1. Update AI extraction prompt to extract semantic attributes
2. After extraction, compute `group_key` based on schema config
3. Insert into `item_attributes` table
4. Handle backfill for existing items (optional batch job)

### Phase 3: API Endpoints

1. `GET /api/attributes/schemas`
2. `GET /api/items/:id/attributes`
3. `GET /api/connections/:schemaId/groups`
4. User connection preferences endpoints

### Phase 4: Enhanced Item Detail View

1. Create new `ItemDetailView` component (full-screen)
2. Implement swipe gesture handling with Framer Motion
3. Add position indicator
4. Migrate from `ItemDetailSheet` to new view

### Phase 5: Connection Filter Integration

1. Fetch item attributes when viewing item detail
2. Build connection chips from attributes
3. Implement filtered navigation logic
4. Add visual feedback for filter state

---

## TypeScript Types

```typescript
// types/connections.ts

export interface AttributeSchema {
  id: string;
  key: string;
  display_name: string;
  unit: string | null;
  grouping_type: 'range' | 'discrete' | 'color';
  grouping_config: {
    ranges?: [number, number][];
    labels?: string[];
  } | null;
  applicable_item_types: string[] | null;
  extraction_priority: number;
}

export interface ItemAttribute {
  id: string;
  item_id: string;
  schema_id: string;
  raw_value: string;
  normalized_value: Record<string, unknown>;
  group_key: string;
  confidence: number;
  extracted_at: string;
}

export interface ConnectionGroup {
  schema_id: string;
  group_key: string;
  display_name: string;
  item_count: number;
  item_ids: string[];
}

export interface UserPinnedConnection {
  id: string;
  user_id: string;
  schema_id: string;
  is_active: boolean;
  display_order: number;
}

// Extended item type with attributes
export interface ItemWithAttributes extends Item {
  attributes: Record<string, ItemAttribute>;
}
```

---

## UI/UX Guidelines

### Animation Principles

1. **Spring physics** for swipe settle (natural feel)
2. **Gesture velocity** considered for momentum
3. **Haptic feedback** on item change (iOS)
4. **Parallax** on background elements (0.3x foreground speed)

### Accessibility

1. Swipe navigation also available via buttons (< > arrows)
2. Screen reader announces item changes
3. High contrast mode support for chips
4. Keyboard navigation (left/right arrows)

### Performance

1. Preload adjacent item images
2. Lazy load attribute data
3. Virtualize connection chips if >10
4. Debounce filter changes

---

## Migration Path from ItemDetailSheet

The current `ItemDetailSheet` at `app/collections/components/ItemDetailSheet.tsx` should be preserved for backwards compatibility during transition:

1. Create new `ItemDetailView` component
2. Add feature flag to switch between sheet and full-screen view
3. Test both paths thoroughly
4. Remove feature flag and old component after validation

---

## Testing Checklist

- [ ] Swipe left navigates to next item
- [ ] Swipe right navigates to previous item
- [ ] Position indicator updates correctly
- [ ] Filter chips show correct counts
- [ ] Filtered navigation only shows matching items
- [ ] Clear filter returns to full list
- [ ] Haptic feedback triggers on iOS
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes
- [ ] Performance acceptable with 100+ items
