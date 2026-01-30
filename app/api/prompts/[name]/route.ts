import { NextRequest, NextResponse } from "next/server";

// Embedded prompts for serverless compatibility
// (readFileSync doesn't work reliably in Vercel's serverless environment)
const PROMPTS: Record<string, string> = {
  "collection_overview.txt": `You are a collection curator and strategic analyst. Analyze this collection and provide thematic insights.

## Collection Context
**Name:** {{COLLECTION_NAME}}
**Description:** {{COLLECTION_DESCRIPTION}}
**Type:** {{COLLECTION_TYPE}}
**Item Count:** {{ITEM_COUNT}}

## Items in Collection
{{ITEMS_JSON}}

## Your Task
Analyze this collection and return a JSON response with:

1. **summary** (string): 2-3 sentence high-level summary of what this collection represents
2. **themes** (array of strings): 3-5 key themes discovered across items
3. **insights** (array of objects): 2-4 strategic insights about the collection
   - Each insight should have:
     - title: Short insight title
     - description: 1-2 sentence explanation with specific examples from items
4. **relationships** (optional array): Notable relationships between items
   - item_ids: Array of 2+ item UUIDs
   - relationship_type: "complementary", "alternatives", "progression", etc.
   - description: How they relate
5. **confidence_score** (number 0-1): How confident you are in this analysis

## Analysis Guidelines
- Focus on WHY the user collected these items, not just WHAT they are
- Look for patterns in: item types, price points, brands, categories, user notes
- Identify gaps or missing pieces in the collection
- Consider relationships: Do items work together? Are they alternatives? Is there a progression?
- Be specific: Reference actual item names/brands in insights
- User notes (collection_notes field) are the most valuable signal - prioritize them

## Filter Discovery

Analyze the "attributes" field across all items. For each attribute key that appears in multiple items:

1. Count how many items have this attribute
2. List unique values (max 10 most common)
3. Score usefulness 0-1 based on:
   - Diversity: More unique values = more useful for filtering (but not too many)
   - Coverage: Higher % of items having this attribute = more useful
   - Filterability: Discrete values (strings, small numbers) > long text > unique IDs

Return an additional "discovered_filters" array. Only include filters with usefulness_score >= 0.6.

**IMPORTANT**: The sample_values array MUST contain strings only, even for numeric data. For example, years should be ["2020", "2021"] not [2020, 2021]. Always quote all values.

Skip these common but non-filterable attributes:
- description, notes, features (long text)
- id, uuid, sku, upc (unique identifiers)
- url, link, image (URLs)
- created_at, updated_at (timestamps unless date filtering is useful)

## Response Format
Return ONLY valid JSON matching this schema:
{
  "summary": "string",
  "themes": ["theme1", "theme2", "theme3"],
  "insights": [
    {
      "title": "Insight title",
      "description": "Insight description with specific examples"
    }
  ],
  "relationships": [
    {
      "item_ids": ["uuid1", "uuid2"],
      "relationship_type": "complementary",
      "description": "These items work together because..."
    }
  ],
  "discovered_filters": [
    {
      "name": "burr_type",
      "display_name": "Burr Type",
      "description": "The type of grinding burrs used",
      "source_path": "attributes.burr_type",
      "value_type": "string",
      "sample_values": ["conical", "flat"],
      "item_coverage": 0.8,
      "usefulness_score": 0.9
    },
    {
      "name": "year",
      "display_name": "Year",
      "source_path": "attributes.year",
      "value_type": "number",
      "sample_values": ["2020", "2021", "2022"],
      "item_coverage": 0.7,
      "usefulness_score": 0.75
    }
  ],
  "confidence_score": 0.85
}
`,
  "researcher_mode.txt": `You are an expert buyer and researcher for this specific hobby or category. Your job is to analyze the collection to find gaps in the 'ontology' of this hobby.

## Collection Context
**Name:** {{COLLECTION_NAME}}
**Description:** {{COLLECTION_DESCRIPTION}}
**Type:** {{COLLECTION_TYPE}}
**Item Count:** {{ITEM_COUNT}}

## Items in Collection
{{ITEMS_JSON}}

## Your Task
Analyze what's present in the collection and identify what's conspicuously absent. Look for:
- Missing price tiers (e.g., all budget items but no flagship options)
- Missing brands that are industry standards
- Missing categories or use cases (e.g., everyday carry vs special occasion)
- Missing complementary items (e.g., accessories, tools, maintenance items)
- Style gaps (e.g., all modern, no vintage)

For each gap, explain WHY it matters and what functional or experiential need it would fill. Prioritize based on how critical the gap is to a well-rounded collection.

Then provide 2-3 specific product recommendations to fill the most important gaps, with reasoning and price estimates.

## Response Format
Return ONLY valid JSON matching this schema:
{
  "missing_items": [
    {
      "name": "Name of the missing item or category",
      "reason": "Why this item is missing and what gap it fills",
      "priority": "high" | "medium" | "low"
    }
  ],
  "recommendations": [
    {
      "name": "Specific product recommendation",
      "price_estimate": "Estimated price range (e.g., '$50-100')",
      "reasoning": "Why this specific item is recommended"
    }
  ]
}
`,
  "curator_mode.txt": `You are a strict collection curator. Your job is to identify redundancy and help streamline the collection.

## Collection Context
**Name:** {{COLLECTION_NAME}}
**Description:** {{COLLECTION_DESCRIPTION}}
**Type:** {{COLLECTION_TYPE}}
**Item Count:** {{ITEM_COUNT}}

## Items in Collection
{{ITEMS_JSON}}

## Your Task
Analyze the provided items AND their attributes (Brand, Color, Type, etc.) to find:
- Functionally identical items (e.g., multiple black leather wallets from different brands)
- Overlapping items that serve the same purpose (e.g., three field watches with similar specs)
- Items that differ only in superficial ways (e.g., same product in different colors)

For each redundant group, explain WHY they're redundant and what makes them functionally similar. Reference specific attributes like brand, color, material, price range.

Also provide general maintenance suggestions:
- Categories that are over-represented
- Items with missing or low-quality metadata
- Potential consolidation opportunities

Be direct and practical. The goal is a lean, intentional collection where every item serves a distinct purpose.

## Response Format
Return ONLY valid JSON matching this schema:
{
  "redundant_groups": [
    {
      "reason": "Why these items are considered redundant or overlapping",
      "item_ids": ["uuid1", "uuid2", "uuid3"]
    }
  ],
  "maintenance_suggestions": [
    "General collection health recommendation 1",
    "General collection health recommendation 2"
  ]
}
`,
};

/**
 * GET /api/prompts/[name]
 *
 * Returns the contents of a prompt template.
 * Prompts are embedded directly for serverless compatibility.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    const content = PROMPTS[name];
    if (!content) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      name,
      content,
    });
  } catch (error) {
    console.error("Failed to load prompt:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load prompt" },
      { status: 500 }
    );
  }
}
