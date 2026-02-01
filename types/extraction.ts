import { z } from "zod";

// Schema for semantic attributes (AI-extracted for filtering/connections)
export const SemanticAttributesSchema = z.object({
  color: z.string().optional().describe("Primary color of the item"),
  material: z.string().optional().describe("Primary material"),
  style: z.string().optional().describe("Style descriptor (casual, formal, vintage, etc.)"),
  size_category: z.string().optional().describe("Size classification (small, medium, large, oversized)"),
}).optional();

export type SemanticAttributes = z.infer<typeof SemanticAttributesSchema>;

// Zod schema for product extraction
export const ProductExtractionSchema = z.object({
  item_type: z.string().default("product").describe("System-level type (watch, wine, product, etc.)"),
  title: z.string().describe("The product name or title"),
  brand: z.string().nullable().describe("The brand or manufacturer"),
  price: z.number().nullable().describe("The price as a number (without currency symbols)"),
  currency: z.string().nullable().describe("The currency code (USD, EUR, GBP, etc.)"),
  retailer: z.string().nullable().describe("The website or store name"),
  image_url: z.string().url().nullable().describe("The main product image URL"),
  category: z.string().nullable().describe("Product category (electronics, clothing, home, etc.)"),
  tags: z.array(z.string()).nullable().describe("Relevant tags or keywords"),
  attributes: z.record(z.unknown()).describe("Additional product-specific attributes (size, color, specs, etc.)"),
  semantic_attributes: SemanticAttributesSchema.describe("Semantic attributes for filtering and connections"),
  confidence_score: z.number().min(0).max(1).describe("Confidence in extraction quality (0-1)"),
});

export type ProductExtraction = z.infer<typeof ProductExtractionSchema>;

// Photo identification schemas (for photo → product URL flow)
export const PhotoIdentificationItemSchema = z.object({
  title: z.string().describe("Best guess at product name including brand"),
  brand: z.string().nullable().describe("Brand or manufacturer if identifiable"),
  item_type: z.string().default("product").describe("Entity type (watch, wine, book, sneaker, etc.)"),
  category: z.string().nullable().describe("Product category"),
  search_query: z.string().describe("Precise search query to find this exact product online"),
  confidence_score: z.number().min(0).max(1).describe("Confidence in identification (0-1)"),
  distinguishing_features: z.string().describe("Key visual features for matching against search results"),
});

export type PhotoIdentificationItem = z.infer<typeof PhotoIdentificationItemSchema>;

export const PhotoIdentificationSchema = z.object({
  items: z.array(PhotoIdentificationItemSchema),
  item_count: z.number(),
  scene_description: z.string().describe("Brief description of what the photo shows"),
});

export type PhotoIdentification = z.infer<typeof PhotoIdentificationSchema>;

// API request/response types
export interface ExtractRequest {
  url: string;
}

export interface ExtractResponse {
  success: boolean;
  data?: ProductExtraction & {
    source_url: string;
    raw_markdown: string;
    extraction_model: string;
  };
  error?: string;
  needs_review?: boolean; // Flag for low confidence extractions (< 0.7)
}
