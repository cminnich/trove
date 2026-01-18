# Feature: Knowledge OS - Galaxy Spatial Experience

**Created**: 2026-01-17
**Status**: Planning
**Complexity**: High

## Overview

Transform Trove from a utility-first capture tool into a high-fidelity, spatial "Knowledge OS." The default experience becomes an immersive Galaxy view where items orbit collection Nebulae, with semantic connections visualized as filaments. A meditative capture flow prioritizes spatial placement as the gateway action.

## Success Criteria

### MVP (Stage 1-3)
- [ ] Coordinate alignment fixed: Nebulae and SVG edges share unified world space
- [ ] Galaxy/Ledger toggle in Settings (feature flag)
- [ ] Immediate Galaxy: Galaxy appears during extraction (Seed pulses as metadata arrives)
- [ ] "The Snap" animation with haptic feedback on mobile
- [ ] Long-press (1000ms) creates new nebula in empty space
- [ ] First-run experience forces collection creation

### Full Vision (Stage 4-5)
- [ ] Inventory HUD replaces detail sheet everywhere
- [ ] Horizontal carousel for Connection Mode selection
- [ ] Semantic attribute extraction (AI-detected groupable attributes)
- [ ] Kinetic swiping through connected items with parallax camera movement
- [ ] Refined Socratic inquiry flow themed by collection

## Architecture Decisions

### Coordinate System ("World Space")
```
Current Bug: Nebulae offset to top-left, SVG edges centered

Solution: Unified world coordinate system
- Canvas has fixed dimensions (e.g., 4000x4000 virtual units)
- Center of canvas = (0, 0) in world space
- All positions stored as world coordinates
- ViewTransform handles pan/zoom uniformly for both:
  - DOM node container (CSS transform)
  - SVG layer (viewBox or transform)
- Both layers share identical transform origin
```

### State Machine Phases (Reordered)
```
ARRIVAL (Immediate)
  ├── Create item in DB (status: pending)
  ├── Start extraction in background
  └── Immediately transition to SPATIAL

SPATIAL (Galaxy + Seed)
  ├── Show Galaxy with floating Seed
  ├── Seed pulses/transforms as extraction completes
  ├── User drags Seed to Nebula → SNAP → INQUIRY
  └── Long-press empty space → Create Nebula modal

INQUIRY (Post-Snap)
  ├── Zoom into item (blur Galaxy backdrop)
  ├── Socratic questions themed by collection
  └── Complete → COMPLETION

COMPLETION
  ├── Success bloom animation
  └── Options: Add Another, View Collection, Explore Galaxy
```

### Animation Primitives

| Animation | Trigger | Visual Description |
|-----------|---------|-------------------|
| **Breathing Seed** | ARRIVAL/SPATIAL | `scale: [1, 1.08, 1]` 3s ease-in-out loop, subtle glow pulse |
| **Extraction Pulse** | Metadata arrives | Ring expands outward from Seed, color shifts to extracted image |
| **Magnetic Approach** | Seed near Nebula | Seed tilts toward nebula, velocity increases, trailing particles |
| **The Snap** | Commit placement | Accelerate → shrink → iridescent pulse → orbit settle → haptic ping |
| **Nebula Activation** | Seed in range | Nebula scales 1.1x, glow intensifies, orbiting items drift inward |
| **Long-press Creation** | 1000ms hold | Ripple emanates from touch point, modal slides up on completion |

### The Snap Sequence (Detailed)
```typescript
// Duration: ~800ms total
const snapSequence = {
  phase1_accelerate: {
    duration: 200,
    easing: 'easeIn',
    transform: 'translateToward(nebulaCenter)',
    scale: [1, 0.9],
  },
  phase2_approach: {
    duration: 300,
    easing: 'easeOut',
    transform: 'snapToOrbitPosition',
    scale: [0.9, 0.6],
    filter: 'brightness(1.5)',
  },
  phase3_pulse: {
    duration: 150,
    effect: 'iridescent glow ring expands',
    haptic: 'impactMedium', // iOS haptic
  },
  phase4_settle: {
    duration: 150,
    easing: 'spring(400, 30)',
    transform: 'settleIntoOrbit',
    scale: [0.6, 0.5],
  },
}
```

### Semantic Layer Data Model

```sql
-- System-defined attribute categories
CREATE TABLE attribute_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,           -- 'case_size', 'price_range', 'color'
  display_name TEXT NOT NULL,         -- 'Case Size', 'Price Range', 'Color'
  unit TEXT,                          -- 'mm', 'USD', null
  grouping_type TEXT NOT NULL,        -- 'range', 'discrete', 'color'
  grouping_config JSONB,              -- { "ranges": [[0,34], [35,38], [39,42], [43,999]] }
  applicable_item_types TEXT[],       -- ['watch', 'jewelry'] or null for all
  extraction_priority INT DEFAULT 0,  -- Higher = more likely to extract
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI-extracted attribute values per item
CREATE TABLE item_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  schema_id UUID REFERENCES attribute_schemas(id),
  raw_value TEXT,                     -- '38' (as extracted)
  normalized_value JSONB,             -- { "value": 38, "unit": "mm" }
  group_key TEXT,                     -- '35-38mm' (computed from schema ranges)
  confidence FLOAT,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, schema_id)
);

-- User's pinned connection modes (which attributes to visualize)
CREATE TABLE user_pinned_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  schema_id UUID REFERENCES attribute_schemas(id),
  is_active BOOLEAN DEFAULT true,     -- Currently showing in Galaxy
  display_order INT,
  pinned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, schema_id)
);

-- Indexes for fast grouping queries
CREATE INDEX item_attributes_group_key_idx ON item_attributes(schema_id, group_key);
CREATE INDEX item_attributes_item_idx ON item_attributes(item_id);
```

### Inventory HUD Layout

```
┌─────────────────────────────────────────────────┐
│  [←]                              [Collection]  │  ← Header: back, collection name
│                                                 │
│                                                 │
│            ┌─────────────────┐                  │
│            │                 │                  │  ← Parallax floating item
│            │   Item Image    │ ← Float effect   │     with subtle drift
│            │                 │                  │
│            └─────────────────┘                  │
│                                                 │
│         Title / Brand / Price                   │  ← Key metadata
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ Connection Filament Visualization         │  │  ← Horizontal line showing
│  │ ○──●──○──○──○                             │  │     connected items (dots)
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ [Price] [Size] [Color] [Brand] [Year]   │    │  ← Horizontal carousel
│  └─────────────────────────────────────────┘    │     (Radio Dial)
│                                                 │
│            ↔ Swipe to navigate                  │  ← Gesture hint
└─────────────────────────────────────────────────┘

Background: Galaxy with backdrop-blur-xl, nebula colors bleeding through
```

### Kinetic Swiping Mechanics

```typescript
// When user swipes left/right in HUD:
1. Determine next/prev item along active connection filament
2. Animate camera "flying" through blurred Galaxy backdrop
3. Parallax layers:
   - Background nebulae: slow movement (0.2x swipe velocity)
   - Mid-ground items: medium movement (0.5x)
   - Foreground focus: 1:1 with gesture
4. Land on next item with spring settle
5. Update HUD content with staggered reveal
```

## Staged Implementation Plan

---

### Stage 1: Foundation (Coordinate Alignment + Primitives)

**Goal**: Fix the coordinate bug and establish animation infrastructure.

#### 1.1 World Coordinate System
- Create `useWorldCoordinates` hook that manages unified transform
- Refactor `GalaxyCanvas` to use single coordinate origin for both DOM and SVG
- Store nebula positions as world coords, transform on render
- Test: Pan/zoom should keep edges aligned with nebulae at all scales

#### 1.2 Animation Primitives Library
Create `/app/components/Galaxy/animations/`:
- `useMagneticAttraction.ts` - Physics for seed approaching nebula
- `useSnapAnimation.ts` - The Snap sequence with spring physics
- `useBreathingPulse.ts` - Configurable breathing effect
- `useRippleEffect.ts` - For long-press and snap feedback
- `useHaptics.ts` - iOS haptic wrapper (vibrate API fallback)

#### 1.3 Galaxy/Ledger Toggle
- Add `galaxyViewEnabled` to user preferences (settings page)
- Create feature flag check in navigation
- When disabled: `/` routes to current list/grid view
- When enabled: `/` routes to Galaxy view

#### Files to Create/Modify:
```
app/components/Galaxy/
├── hooks/
│   ├── useWorldCoordinates.ts     (NEW)
│   ├── useMagneticAttraction.ts   (NEW)
│   ├── useSnapAnimation.ts        (NEW)
│   └── useHaptics.ts              (NEW)
├── GalaxyCanvas.tsx               (MODIFY - coord system)
├── Nebula.tsx                     (MODIFY - world coords)
├── Seed.tsx                       (MODIFY - magnetic physics)
└── GalaxyEdge.tsx                 (MODIFY - world coords)

app/(authenticated)/settings/
└── page.tsx                       (MODIFY - add toggle)

lib/
└── preferences.ts                 (NEW - user prefs store)
```

#### Estimated Scope: ~15-20 component changes, 5-6 new hooks

---

### Stage 2: Kinetic Galaxy (Immediate Galaxy + The Snap)

**Goal**: Reorder capture flow so Galaxy appears immediately; implement magnetic placement.

#### 2.1 Immediate Galaxy Flow
- Remove "Arrival" phase as separate screen
- On URL share:
  1. Create item in DB immediately (pending extraction)
  2. Render Galaxy with Seed in center
  3. Seed shows loading state (no image yet)
  4. As extraction completes, Seed transforms (image appears, pulse effect)
- Seed is draggable immediately (even during extraction)

#### 2.2 The Snap Implementation
- When Seed is dragged near Nebula (threshold: 80px):
  - Nebula enters "active" state (glow, scale up)
  - Seed experiences magnetic pull (velocity bias toward nebula)
- On release within threshold:
  - Trigger Snap animation sequence (800ms)
  - Haptic feedback at pulse phase
  - After settle: transition to Inquiry phase
- On release outside any nebula:
  - Seed returns to neutral position with spring physics

#### 2.3 Nebula Creation Gesture
- Long-press (1000ms) on empty canvas space:
  - Show ripple effect at touch point
  - Vibrate on threshold reached
  - Open "New Collection" modal
  - On save: New nebula appears at touch location
  - Seed can then be placed in new nebula

#### 2.4 First-Run Experience
- If user has 0 collections:
  - Galaxy is empty (just starfield background)
  - Seed floats in center
  - Prominent prompt: "Long-press to create your first collection"
  - Cannot proceed until at least one nebula exists

#### Files to Create/Modify:
```
app/add/
├── hooks/
│   └── useMeditativeCapture.ts    (MODIFY - remove Arrival phase)
├── components/
│   └── SpatialPhaseView.tsx       (MODIFY - immediate extraction)
└── page.tsx                       (MODIFY - flow logic)

app/components/Galaxy/
├── Seed.tsx                       (MODIFY - magnetic physics, loading state)
├── Nebula.tsx                     (MODIFY - active glow, snap target)
├── GalaxyCanvas.tsx               (MODIFY - snap orchestration)
└── NewNebulaModal.tsx             (NEW - collection creation)

app/api/items/
└── route.ts                       (MODIFY - return immediately, extract async)
```

#### Estimated Scope: ~10-15 component changes, 2-3 new components

---

### Stage 3: Database Migration (Semantic Layer)

**Goal**: Create schema for semantic attributes and user connections.

#### 3.1 Migration: Attribute Tables
```sql
-- Run via Supabase migration
CREATE TABLE attribute_schemas (...);
CREATE TABLE item_attributes (...);
CREATE TABLE user_pinned_connections (...);
```

#### 3.2 Seed Attribute Schemas
Initial system-defined schemas:
- `price_range`: ranges [0-100, 100-500, 500-1000, 1000-5000, 5000+]
- `brand`: discrete values
- `color`: discrete with color codes
- `case_size` (watches): ranges [<35, 35-38, 39-42, 43+]
- `vintage` (wine): decades
- `year`: decades
- `category`: discrete

#### 3.3 Extraction Pipeline Update
- Modify AI extraction prompt to:
  1. Extract raw attribute values
  2. For each `attribute_schemas` row, check if value exists
  3. Compute `group_key` based on `grouping_config`
  4. Insert into `item_attributes`
- Add `extraction_model` field to track which attributes were extracted

#### 3.4 API Endpoints
- `GET /api/attributes/schemas` - List available attribute types
- `GET /api/items/:id/attributes` - Get item's extracted attributes
- `GET /api/connections/:schemaId/groups` - Get all groups with item counts
- `POST /api/user/connections` - Pin/unpin connection modes

#### Files to Create/Modify:
```
supabase/migrations/
└── 011_semantic_attributes.sql    (NEW)

types/
└── semantic.ts                    (NEW - attribute types)

app/api/
├── attributes/
│   └── schemas/route.ts           (NEW)
├── items/[id]/
│   └── attributes/route.ts        (NEW)
└── connections/
    ├── [schemaId]/groups/route.ts (NEW)
    └── route.ts                   (NEW - user pins)

prompts/
└── extraction.txt                 (MODIFY - attribute extraction)

lib/
└── semantic.ts                    (NEW - grouping utilities)
```

#### Estimated Scope: 1 migration, 4-5 new API routes, prompt update

---

### Stage 4: Inventory HUD (Detail View + Connections)

**Goal**: Replace detail sheet with immersive HUD; add connection visualization.

#### 4.1 Inventory HUD Component
- Full-screen overlay when item is tapped
- Background: Galaxy with `backdrop-blur-xl`
- Nebula colors bleed through blur
- Center: Item image with parallax float effect
- Below: Title, brand, price
- Connection filament visualization (horizontal line with dots)
- Bottom: Horizontal carousel of connection modes

#### 4.2 Connection Mode Carousel
- Horizontal scrollable list of attribute chips
- Each chip shows: icon + name (e.g., 🔵 Size)
- Tap to activate mode
- Active mode highlighted
- On activation:
  1. Fetch groups for that schema
  2. Show all group clusters in Galaxy (faded items outside)
  3. Highlight group containing current item

#### 4.3 Group Visualization
- When mode active:
  - Items in same group connected by glowing filament
  - Items outside group fade to 30% opacity
  - Group "nodes" appear showing count (e.g., "37-39mm (12)")
- Filament follows curved path between items

#### 4.4 Kinetic Swiping
- Swipe left/right in HUD:
  1. Determine next item along active filament
  2. Animate Galaxy backdrop panning (parallax)
  3. Current item flies out, next item flies in
  4. Update HUD content with staggered reveal
  5. Haptic tick on item change

#### Files to Create/Modify:
```
app/components/
├── InventoryHUD/
│   ├── InventoryHUD.tsx           (NEW - main container)
│   ├── ItemFocus.tsx              (NEW - centered item with parallax)
│   ├── ConnectionCarousel.tsx     (NEW - mode chips)
│   ├── ConnectionFilament.tsx     (NEW - dot visualization)
│   ├── useKineticSwipe.ts         (NEW - swipe gesture handler)
│   └── useParallaxCamera.ts       (NEW - backdrop movement)
└── Galaxy/
    ├── GalaxyCanvas.tsx           (MODIFY - support HUD overlay mode)
    └── ConnectionLayer.tsx        (NEW - filament rendering)

app/collections/[id]/
└── page.tsx                       (MODIFY - use HUD instead of sheet)
```

#### Estimated Scope: 6-8 new components, 2-3 new hooks

---

### Stage 5: Meditative Socratic Flow (Refined Inquiry)

**Goal**: Polish the post-snap inquiry experience with collection theming.

#### 5.1 Collection-Themed Inquiry
- Background gradient matches collection nebula colors
- Questions reference collection context
- Related items from collection shown subtly

#### 5.2 Zoom Transition
- After Snap completes:
  1. Camera zooms deep into placed item
  2. Galaxy fades to blur
  3. Item scales up to focus size
  4. Question fades in with typewriter effect

#### 5.3 Answer Experience
- Choice questions: Large tap targets, haptic on select
- Open questions: Minimal keyboard, auto-grow textarea
- Scale questions: Smooth slider with haptic detents

#### 5.4 Completion Integration
- After inquiry:
  1. Show synthesized notes briefly
  2. Option to "Explore Connections" → Opens HUD with item
  3. Option to "Add Another" → Resets to Galaxy with new Seed
  4. Option to "View Collection" → Navigates to collection

#### Files to Modify:
```
app/add/components/
├── InquiryFlow.tsx                (MODIFY - collection theming)
├── SocraticQuestion.tsx           (MODIFY - haptic feedback)
└── CompletionPhaseView.tsx        (MODIFY - HUD integration)

app/api/reflection/socratic/
└── route.ts                       (MODIFY - collection context in prompt)
```

#### Estimated Scope: 4-5 component modifications, prompt updates

---

## Out of Scope (Future Considerations)

- **Vector DB / Embeddings**: Not needed for MVP; semantic layer uses structured attributes
- **Multi-mode Intersection**: Future enhancement (e.g., "37-39mm AND $500-1k")
- **User-defined Attribute Schemas**: Hybrid model for future; MVP is system-defined
- **Desktop-specific Optimizations**: Mobile-first; desktop gets same experience
- **Light Mode**: Dark mode only for now
- **Public Galaxy Sharing**: Authentication/sharing features deferred

## Open Questions

1. **Nebula Creation Modal**: Should it use the existing CreateCollectionSheet or a new minimal version?
2. **Extraction Failure Handling**: If extraction fails while Seed is in Galaxy, what happens? Show error state on Seed?
3. **Offline Support**: Should Galaxy work offline with cached data?
4. **Performance Threshold**: Max number of nebulae/items before performance degrades?

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Coordinate refactor breaks existing flow | High | Create parallel "v2" components; A/B test |
| Animation performance on older devices | Medium | Use `will-change`, reduce particle counts, test on iPhone SE |
| Semantic extraction adds latency | Medium | Extract attributes async post-initial-extraction |
| Galaxy unusable with 100+ items | High | Implement clustering/LOD for distant nebulae |

## Technical Dependencies

- **Framer Motion 12+**: Already installed; used for all animations
- **@dnd-kit**: Already installed; used for seed dragging
- **Haptic API**: Native `navigator.vibrate()` + iOS specific patterns
- **Supabase**: Existing; new tables for semantic layer

---

## Implementation Checklist

### Stage 1: Foundation
- [ ] Create `useWorldCoordinates` hook
- [ ] Refactor GalaxyCanvas coordinate system
- [ ] Fix Nebula positioning to use world coords
- [ ] Fix GalaxyEdge to align with Nebulae
- [ ] Create animation primitive hooks
- [ ] Add Galaxy/Ledger toggle in Settings
- [ ] Test pan/zoom alignment at all scales

### Stage 2: Kinetic Galaxy
- [ ] Modify capture flow to show Galaxy immediately
- [ ] Implement Seed loading state during extraction
- [ ] Implement Seed transformation on extraction complete
- [ ] Add magnetic physics to Seed near Nebula
- [ ] Implement The Snap animation sequence
- [ ] Add haptic feedback to Snap
- [ ] Implement long-press nebula creation
- [ ] Create first-run empty state experience

### Stage 3: Database Migration
- [ ] Write migration for attribute tables
- [ ] Seed initial attribute schemas
- [ ] Update extraction prompt for attributes
- [ ] Create attribute API endpoints
- [ ] Implement grouping utilities

### Stage 4: Inventory HUD
- [ ] Create InventoryHUD container
- [ ] Implement parallax item focus
- [ ] Create connection mode carousel
- [ ] Implement filament visualization
- [ ] Add kinetic swipe gesture
- [ ] Add parallax camera movement
- [ ] Replace detail sheet with HUD

### Stage 5: Meditative Flow
- [ ] Add collection theming to inquiry
- [ ] Implement zoom transition after snap
- [ ] Add haptic feedback to question answers
- [ ] Update completion with HUD integration
