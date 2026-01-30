# Active AI Modes Implementation

**Status:** ✅ Complete
**Date:** 2026-01-30

## Overview

Implemented three Active AI Modes for collection analysis using the Vercel AI SDK. Collections can now use different AI personas: Standard (general insights), Researcher (gap analysis), and Curator (redundancy detection).

## Deliverables

### 1. Dependencies ✅

Installed:
- `ai` - Vercel AI SDK
- `@ai-sdk/anthropic` - Anthropic provider for Vercel AI SDK

### 2. Database Migration ✅

**File:** `supabase/migrations/021_collection_ai_modes.sql`

- Added `ai_mode` column to `collections` table
- Type: `text` with CHECK constraint (`'standard' | 'researcher' | 'curator'`)
- Default: `'standard'`
- Created index: `idx_collections_ai_mode`
- Added column comment for documentation

**TypeScript Types Updated:**
- `types/database.ts` - Added `ai_mode` to `collections` Row, Insert, and Update types

### 3. Infrastructure Refactor ✅

**File:** `lib/ai.ts`

**New Functions:**
- `generateStructuredData<T>()` - Uses Vercel AI SDK's `generateObject` for structured responses
  - Parameters: model, schema (Zod), system, prompt, temperature
  - Returns: Validated object matching schema

- `generateMarkdown()` - Uses Vercel AI SDK's `generateText` for plain text responses
  - Parameters: model, system, prompt, temperature
  - Returns: Generated text string

**Legacy Support:**
- Kept `callClaudeJSON()` with deprecation notice for backward compatibility
- Maintained `loadPrompt()` and `replaceVars()` helper functions

### 4. Prompt Engineering ✅

**File:** `lib/ai/prompts.ts`

**Zod Schemas:**
- `ResearcherSchema` - Gap analysis output
  - `missing_items[]` - Items missing from collection (name, reason, priority)
  - `recommendations[]` - Specific product recommendations (name, price_estimate, reasoning)

- `CuratorSchema` - Redundancy detection output
  - `redundant_groups[]` - Groups of overlapping items (reason, item_ids)
  - `maintenance_suggestions[]` - Collection health recommendations

**System Prompts:**
- `STANDARD_SYSTEM_PROMPT` - General collection analyst (thematic analysis)
- `RESEARCHER_SYSTEM_PROMPT` - Expert buyer focusing on ontology gaps
- `CURATOR_SYSTEM_PROMPT` - Strict curator identifying redundancy

**Formatters:**
- `formatResearcherOutput()` - Converts structured data to Markdown with priority emojis
- `formatCuratorOutput()` - Converts structured data to Markdown with group numbering

### 5. API Route Updates ✅

**File:** `app/api/collections/[id]/overview/route.ts`

**Changes:**
- Fetch item attributes alongside items for enhanced context
- Mode-based generation logic:
  - **Standard:** Uses legacy `CollectionOverviewSchema` with discovered filters
  - **Researcher:** Uses `ResearcherSchema` with gap analysis prompts
  - **Curator:** Uses `CuratorSchema` with redundancy detection prompts
- All modes store results as Markdown in `ai_overview` column
- GET endpoint returns `ai_mode` in response
- POST endpoint respects collection's `ai_mode` setting
- Reprocess filters mode only supported for Standard mode

**File:** `app/api/collections/[id]/route.ts`

**Changes:**
- Added `ai_mode` to `UpdateCollectionRequest` interface
- Validate `ai_mode` in PATCH request
- Auto-invalidate `ai_overview_valid` when `ai_mode` changes (forces regeneration)
- Include `ai_mode` in update data

### 6. UI Updates ✅

**File:** `app/collections/components/CollectionSettingsDialog.tsx`

**Changes:**
- Added `aiMode` state (synchronized with collection)
- Added AI Persona select dropdown in General Info section:
  - Standard - "General insights and themes"
  - Researcher - "Gap analysis and recommendations"
  - Curator - "Redundancy detection and optimization"
- Include `ai_mode` in PATCH request on save
- Auto-invalidates overview when mode changes

**UX Flow:**
1. User opens Collection Settings
2. Selects AI Persona from dropdown
3. Saves settings (auto-invalidates cached overview)
4. Next time overview is generated, it uses new mode

## Technical Details

### Context-Aware Analysis

All modes receive enriched item data including:
- Item metadata (title, price, brand, category, etc.)
- Collection-specific notes
- Extracted attributes (Brand, Color, Material, Price Range, etc.)
- Position in collection

Example item structure passed to AI:
```json
{
  "id": "uuid",
  "title": "Product Name",
  "brand": "Brand Name",
  "price": 299.99,
  "attributes_data": [
    {
      "schema_name": "brand",
      "display_name": "Brand",
      "raw_value": "Seiko",
      "normalized_value": "seiko"
    }
  ]
}
```

### Storage Format

All modes store output as **Markdown** in `collections.ai_overview`:
- **Standard:** Converts structured JSON to Markdown (themes, insights)
- **Researcher:** Formatted with priority indicators and price estimates
- **Curator:** Formatted with redundancy groups and item IDs

This keeps the database schema simple while enabling structured reasoning.

### Cache Invalidation

Changing `ai_mode` automatically sets `ai_overview_valid = false`, forcing regeneration on next request.

## Testing

✅ Build successful (`npm run build`)
⚠️ Migration needs to be run on Supabase database
⚠️ Manual testing required for all three modes

## Migration Instructions

Run the migration on your Supabase database:

```sql
-- Run: supabase/migrations/021_collection_ai_modes.sql
```

Or via Supabase CLI:
```bash
supabase db push
```

## Example Usage

### Researcher Mode Output

```markdown
# Collection Gap Analysis

## Missing Items

### 🔴 Entry-level automatic watch
**Priority:** High

Your collection has mid-range and luxury pieces but lacks an affordable
entry point for everyday wear.

### 🟡 Dive watch
**Priority:** Medium

No water-resistant options for sports/outdoor activities.

## Recommended Items

### Seiko 5 Sports SRPD
**Estimated Price:** $250-350

Reliable automatic movement, 100m water resistance, excellent value.
```

### Curator Mode Output

```markdown
# Collection Curation Report

## Redundant Items

Found 2 group(s) of redundant or overlapping items:

### Group 1: 3 items
Three black dial field watches with nearly identical specifications
(39-40mm, automatic, leather strap). Consider keeping only your favorite.

**Item IDs:** uuid-1, uuid-2, uuid-3

### Group 2: 2 items
Duplicate coffee grinders - both manual, burr, similar capacity.

**Item IDs:** uuid-4, uuid-5

## Maintenance Suggestions

- Consider diversifying dial colors (80% black dials)
- Missing product images for 3 items
- Price data outdated for items added >6 months ago
```

## Future Enhancements

- Add mode-specific UI indicators in collection header
- Mode-specific filter support (e.g., Curator mode hides filters)
- Batch regeneration tool for migrating existing collections
- Mode presets based on collection type
