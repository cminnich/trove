import { NextRequest, NextResponse } from "next/server";

// Embedded prompts for serverless compatibility
// (readFileSync doesn't work reliably in Vercel's serverless environment)
const PROMPTS: Record<string, string> = {
  "collection_overview.txt": `Analyze this collection for thematic insights.

{{COLLECTION_NAME}} ({{ITEM_COUNT}} items)
{{COLLECTION_DESCRIPTION}}

{{ITEMS_JSON}}

Provide:
1. **summary**: 2-3 sentence overview
2. **themes**: 3-5 key themes
3. **insights**: 2-4 insights with title + description (reference specific items)
4. **relationships**: (optional) how items relate (complementary, alternatives, progression)
5. **confidence_score**: 0-1

Focus on WHY items were collected. Look for patterns in types, price, brands, categories. Prioritize collection_notes field when present.

**Filter Discovery**: For attributes appearing in 2+ items, score usefulness (0-1) based on diversity, coverage, and filterability. Only include if score >= 0.6. Sample values must be strings. Skip: long text, unique IDs, URLs, timestamps.

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
  "researcher_mode.txt": `Analyze this collection for gaps in its ontology. Identify what's missing to make it well-rounded.

{{COLLECTION_NAME}} ({{ITEM_COUNT}} items)
{{COLLECTION_DESCRIPTION}}

{{ITEMS_JSON}}

Find gaps:
- Missing price tiers
- Missing industry-standard brands
- Missing categories or use cases
- Missing complementary items/accessories
- Style gaps

Explain why each gap matters and prioritize by importance. Provide 2-3 specific product recommendations with price estimates.

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
  "curator_mode.txt": `Identify redundant items in this collection. Group items that are functionally identical or serve the same purpose.

{{COLLECTION_NAME}} ({{ITEM_COUNT}} items)
{{COLLECTION_DESCRIPTION}}

{{ITEMS_JSON}}

Find:
- Functionally identical items
- Items serving the same purpose with similar specs
- Items differing only superficially

Reference specific attributes (brand, color, material, price) when explaining redundancy. Suggest maintenance actions for over-represented categories or missing metadata.

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
