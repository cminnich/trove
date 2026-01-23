import type { Database } from "@/types/database";
import type { SemanticAttributes } from "@/types/extraction";

type AttributeSchema = Database["public"]["Tables"]["attribute_schemas"]["Row"];
type CollectionAttributeSchema = Database["public"]["Tables"]["collection_attribute_schemas"]["Row"];
type ItemAttributeInsert = Database["public"]["Tables"]["item_attributes"]["Insert"];

// Price range buckets for normalization
const PRICE_RANGES = [
  { max: 50, label: "Under $50", key: "under-50" },
  { max: 100, label: "$50-$100", key: "50-100" },
  { max: 250, label: "$100-$250", key: "100-250" },
  { max: 500, label: "$250-$500", key: "250-500" },
  { max: 1000, label: "$500-$1,000", key: "500-1000" },
  { max: 5000, label: "$1,000-$5,000", key: "1000-5000" },
  { max: Infinity, label: "$5,000+", key: "5000-plus" },
] as const;

interface ItemData {
  id: string;
  brand: string | null;
  price: number | null;
  category: string | null;
  retailer: string | null;
  item_type: string;
}

interface ExtractedSemanticAttributes {
  color?: string;
  material?: string;
  style?: string;
  size_category?: string;
}

/**
 * Normalize a string value for comparison (lowercase, trim, collapse whitespace)
 */
function normalizeValue(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Get price range bucket for a given price
 */
function getPriceRange(price: number): { label: string; key: string } {
  for (const range of PRICE_RANGES) {
    if (price < range.max) {
      return { label: range.label, key: range.key };
    }
  }
  return PRICE_RANGES[PRICE_RANGES.length - 1];
}

/**
 * Generate a group_key from schema name and normalized value
 * Format: "schemaName:normalizedValue"
 */
function makeGroupKey(schemaName: string, normalizedValue: string): string {
  return `${schemaName}:${normalizedValue}`;
}

/**
 * Generate item attributes from item data and schemas
 * Handles direct (from item fields), computed (derived), and extracted (AI) attributes
 */
export function generateItemAttributes(
  item: ItemData,
  schemas: AttributeSchema[],
  semanticAttributes?: SemanticAttributes
): ItemAttributeInsert[] {
  const attributes: ItemAttributeInsert[] = [];
  const schemaMap = new Map(schemas.map((s) => [s.name, s]));

  // Process direct attributes (from item fields)
  const directMappings: Array<{ schemaName: string; value: string | null }> = [
    { schemaName: "brand", value: item.brand },
    { schemaName: "category", value: item.category },
    { schemaName: "retailer", value: item.retailer },
    { schemaName: "item_type", value: item.item_type },
  ];

  for (const { schemaName, value } of directMappings) {
    const schema = schemaMap.get(schemaName);
    if (schema && schema.is_active && value) {
      const normalized = normalizeValue(value);
      attributes.push({
        item_id: item.id,
        schema_id: schema.id,
        raw_value: value,
        normalized_value: normalized,
        group_key: makeGroupKey(schemaName, normalized),
        confidence: 1.0, // Direct values have full confidence
      });
    }
  }

  // Process computed attributes (derived from item fields)
  const priceRangeSchema = schemaMap.get("price_range");
  if (priceRangeSchema && priceRangeSchema.is_active && item.price !== null && item.price > 0) {
    const range = getPriceRange(item.price);
    attributes.push({
      item_id: item.id,
      schema_id: priceRangeSchema.id,
      raw_value: `$${item.price.toLocaleString()}`,
      normalized_value: range.key,
      group_key: makeGroupKey("price_range", range.key),
      confidence: 1.0,
    });
  }

  // Process extracted semantic attributes (from AI extraction)
  if (semanticAttributes) {
    const extractedMappings: Array<{
      schemaName: string;
      value: string | undefined;
    }> = [
      { schemaName: "color", value: semanticAttributes.color },
      { schemaName: "material", value: semanticAttributes.material },
      { schemaName: "style", value: semanticAttributes.style },
      { schemaName: "size_category", value: semanticAttributes.size_category },
    ];

    for (const { schemaName, value } of extractedMappings) {
      const schema = schemaMap.get(schemaName);
      if (schema && schema.is_active && value) {
        const normalized = normalizeValue(value);
        attributes.push({
          item_id: item.id,
          schema_id: schema.id,
          raw_value: value,
          normalized_value: normalized,
          group_key: makeGroupKey(schemaName, normalized),
          confidence: 0.85, // AI-extracted values have slightly lower confidence
        });
      }
    }
  }

  return attributes;
}

/**
 * Parse semantic attributes from extraction response
 * Handles both the new semantic_attributes field and legacy attributes field
 */
export function parseSemanticAttributes(
  semanticAttrs?: SemanticAttributes,
  legacyAttrs?: Record<string, unknown>
): ExtractedSemanticAttributes {
  const result: ExtractedSemanticAttributes = {};

  // Prefer new semantic_attributes if available
  if (semanticAttrs) {
    if (semanticAttrs.color) result.color = semanticAttrs.color;
    if (semanticAttrs.material) result.material = semanticAttrs.material;
    if (semanticAttrs.style) result.style = semanticAttrs.style;
    if (semanticAttrs.size_category) result.size_category = semanticAttrs.size_category;
  }

  // Fallback to legacy attributes for color/material if not in semantic_attributes
  if (legacyAttrs) {
    if (!result.color && typeof legacyAttrs.color === "string") {
      result.color = legacyAttrs.color;
    }
    if (!result.material && typeof legacyAttrs.material === "string") {
      result.material = legacyAttrs.material;
    }
    // Check case_material for watches
    if (!result.material && typeof legacyAttrs.case_material === "string") {
      result.material = legacyAttrs.case_material;
    }
  }

  return result;
}

/**
 * Get display label for a group_key
 */
export function getDisplayLabel(groupKey: string, schemas: AttributeSchema[]): string {
  const [schemaName, normalizedValue] = groupKey.split(":", 2);
  const schema = schemas.find((s) => s.name === schemaName);

  if (!schema) return normalizedValue;

  // Handle price range display
  if (schemaName === "price_range") {
    const range = PRICE_RANGES.find((r) => r.key === normalizedValue);
    return range?.label || normalizedValue;
  }

  // Title case the normalized value for display
  return normalizedValue
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get all unique group_keys for a schema from a list of attributes
 */
export function getUniqueGroupKeys(
  attributes: Array<{ group_key: string; schema_id: string }>,
  schemaId: string
): string[] {
  const keys = new Set<string>();
  for (const attr of attributes) {
    if (attr.schema_id === schemaId) {
      keys.add(attr.group_key);
    }
  }
  return Array.from(keys).sort();
}

/**
 * Get a nested value from an object using a dot-notation path
 * e.g., "attributes.burr_type" -> obj.attributes.burr_type
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Extract a dynamic attribute from an item based on a collection schema
 * Returns null if the value doesn't exist or is not extractable
 */
export function extractDynamicAttribute(
  item: { id: string; attributes?: Record<string, unknown> },
  schema: Pick<CollectionAttributeSchema, "id" | "name" | "source_path" | "value_type">
): Omit<ItemAttributeInsert, "schema_id"> | null {
  // Get the value from the item using the source path
  const value = getNestedValue(item as Record<string, unknown>, schema.source_path);

  // Skip null, undefined, or empty values
  if (value === undefined || value === null || value === "") {
    return null;
  }

  // Convert to string for storage
  let rawValue: string;
  if (typeof value === "string") {
    rawValue = value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    rawValue = String(value);
  } else if (Array.isArray(value)) {
    // For arrays, join with comma or skip if empty
    if (value.length === 0) return null;
    rawValue = value.join(", ");
  } else {
    // Skip complex objects
    return null;
  }

  // Skip very long values (likely descriptions or notes)
  if (rawValue.length > 200) {
    return null;
  }

  const normalized = normalizeValue(rawValue);

  return {
    item_id: item.id,
    collection_schema_id: schema.id,
    raw_value: rawValue,
    normalized_value: normalized,
    group_key: makeGroupKey(schema.name, normalized),
    confidence: 0.85, // AI-discovered attributes
  };
}

/**
 * Extract dynamic attributes for multiple items from a collection schema
 * Returns array of insertable attributes
 */
export function extractDynamicAttributesForItems(
  items: Array<{ id: string; attributes?: Record<string, unknown> }>,
  schema: Pick<CollectionAttributeSchema, "id" | "name" | "source_path" | "value_type">
): Omit<ItemAttributeInsert, "schema_id">[] {
  const attributes: Omit<ItemAttributeInsert, "schema_id">[] = [];

  for (const item of items) {
    const attr = extractDynamicAttribute(item, schema);
    if (attr) {
      attributes.push(attr);
    }
  }

  return attributes;
}
