import { z } from "zod";

/**
 * Valid value types for discovered filters
 */
const VALID_VALUE_TYPES = ["string", "number", "numeric_range"] as const;
type ValueType = typeof VALID_VALUE_TYPES[number];

/**
 * Coerce any value to a valid value_type
 * AI may return 'array', 'object', 'boolean', etc. - normalize to valid types
 */
function coerceValueType(val: unknown): ValueType {
  if (typeof val !== "string") return "string";
  const normalized = val.toLowerCase().trim();
  if (VALID_VALUE_TYPES.includes(normalized as ValueType)) {
    return normalized as ValueType;
  }
  // Common AI mistakes - map to sensible defaults
  if (normalized === "array" || normalized === "list") return "string";
  if (normalized === "integer" || normalized === "float" || normalized === "decimal") return "number";
  if (normalized === "range" || normalized === "number_range") return "numeric_range";
  if (normalized === "boolean" || normalized === "bool") return "string";
  if (normalized === "date" || normalized === "datetime") return "string";
  return "string";
}

/**
 * Flatten any value to an array of strings
 * Handles: arrays of arrays, objects, numbers, nested structures
 */
function flattenToStringArray(val: unknown): string[] {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) {
    return val.flatMap((item) => flattenToStringArray(item));
  }
  if (typeof val === "object") {
    // For objects, try to extract meaningful string representation
    return [JSON.stringify(val)];
  }
  return [String(val)];
}

/**
 * Coerce a number-like value to a valid 0-1 range
 */
function coerceScore(val: unknown): number {
  if (typeof val === "number") {
    return Math.max(0, Math.min(1, val));
  }
  if (typeof val === "string") {
    const num = parseFloat(val);
    if (!isNaN(num)) return Math.max(0, Math.min(1, num));
  }
  return 0.5; // Default middle score
}

/**
 * Schema for AI-discovered filter from item attributes
 *
 * This schema is designed to be resilient to common AI response variations:
 * - Invalid value_type enums are coerced to 'string'
 * - Nested arrays in sample_values are flattened
 * - Numbers/booleans in sample_values are converted to strings
 * - Out-of-range scores are clamped to 0-1
 */
export const DiscoveredFilterSchema = z.object({
  name: z.preprocess(
    (val) => (typeof val === "string" ? val : String(val || "unknown")),
    z.string()
  ),
  display_name: z.preprocess(
    (val) => (typeof val === "string" ? val : String(val || "Unknown")),
    z.string()
  ),
  description: z.preprocess(
    (val) => (val === null || val === undefined ? undefined : String(val)),
    z.string().optional()
  ),
  source_path: z.preprocess(
    (val) => (typeof val === "string" ? val : String(val || "attributes.unknown")),
    z.string()
  ),
  value_type: z.preprocess(coerceValueType, z.enum(VALID_VALUE_TYPES)),
  sample_values: z.preprocess(flattenToStringArray, z.array(z.string())),
  item_coverage: z.preprocess(coerceScore, z.number()),
  usefulness_score: z.preprocess(coerceScore, z.number()),
});

export type DiscoveredFilter = z.infer<typeof DiscoveredFilterSchema>;

/**
 * Coerce themes to string array - handles various AI response formats
 */
function coerceThemes(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((v) => String(v)).filter((v) => v.length > 0);
  }
  if (typeof val === "string") {
    // AI might return comma-separated string
    return val.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return [];
}

/**
 * Coerce insights to proper format - handles missing fields
 */
function coerceInsights(val: unknown): Array<{ title: string; description: string }> {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      title: String(item.title || item.name || "Untitled"),
      description: String(item.description || item.text || item.content || ""),
    }))
    .filter((item) => item.description.length > 0);
}

/**
 * UUID regex for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Coerce relationships - filter out invalid UUIDs, handle malformed data
 */
function coerceRelationships(val: unknown): Array<{
  item_ids: string[];
  relationship_type: string;
  description: string;
}> | undefined {
  if (val === null || val === undefined) return undefined;
  if (!Array.isArray(val)) return undefined;

  const valid = val
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const itemIds = Array.isArray(item.item_ids)
        ? item.item_ids.filter((id): id is string =>
            typeof id === "string" && UUID_REGEX.test(id)
          )
        : [];

      return {
        item_ids: itemIds,
        relationship_type: String(item.relationship_type || item.type || "related"),
        description: String(item.description || ""),
      };
    })
    .filter((item) => item.item_ids.length >= 2 && item.description.length > 0);

  return valid.length > 0 ? valid : undefined;
}

/**
 * Coerce discovered_filters - filter out completely invalid filters
 */
function coerceDiscoveredFilters(val: unknown): unknown[] | undefined {
  if (val === null || val === undefined) return undefined;
  if (!Array.isArray(val)) return undefined;

  // Filter out entries that are clearly invalid (not objects)
  const filtered = val.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null
  );

  return filtered.length > 0 ? filtered : undefined;
}

/**
 * Schema for AI-generated collection overview
 * Includes thematic analysis, strategic insights, item relationships, and discovered filters
 *
 * This schema is designed to be resilient to common AI response variations:
 * - Missing or malformed fields get sensible defaults
 * - Invalid UUIDs in relationships are filtered out
 * - Themes can be string or array
 * - Insights handle alternative field names
 */
export const CollectionOverviewSchema = z.object({
  summary: z.preprocess(
    (val) => String(val || "No summary available"),
    z.string()
  ),
  themes: z.preprocess(coerceThemes, z.array(z.string())),
  insights: z.preprocess(coerceInsights, z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    })
  )),
  relationships: z.preprocess(
    coerceRelationships,
    z.array(
      z.object({
        item_ids: z.array(z.string().uuid()),
        relationship_type: z.string(),
        description: z.string(),
      })
    ).optional()
  ),
  discovered_filters: z.preprocess(
    coerceDiscoveredFilters,
    z.array(DiscoveredFilterSchema).optional()
  ),
  confidence_score: z.preprocess(coerceScore, z.number()),
});

export type CollectionOverview = z.infer<typeof CollectionOverviewSchema>;

/**
 * Required schema instructions that MUST be appended to any custom prompt
 * This ensures the AI always knows the correct JSON structure to return
 */
export const REQUIRED_SCHEMA_SUFFIX = `

---
## REQUIRED RESPONSE FORMAT (DO NOT MODIFY)

Your response MUST be valid JSON matching this exact schema. No markdown, no explanation - just JSON.

**discovered_filters requirements:**
- value_type MUST be one of: "string", "number", "numeric_range" (NOT "array", "object", "boolean", etc.)
- sample_values MUST be an array of strings (even for numbers: use ["2020", "2021"] not [2020, 2021])
- item_coverage and usefulness_score MUST be numbers between 0 and 1

**Example structure:**
\`\`\`json
{
  "summary": "Brief collection summary",
  "themes": ["theme1", "theme2"],
  "insights": [{"title": "Title", "description": "Description"}],
  "discovered_filters": [
    {
      "name": "attribute_name",
      "display_name": "Display Name",
      "source_path": "attributes.path",
      "value_type": "string",
      "sample_values": ["value1", "value2"],
      "item_coverage": 0.8,
      "usefulness_score": 0.7
    }
  ],
  "confidence_score": 0.85
}
\`\`\`

Return ONLY the JSON object, no additional text.
`;
