import { z } from "zod";

// Zod schema for product extraction
export const ProductExtractionSchema = z.object({
  title: z.string().describe("The product name or title"),
  brand: z.string().nullable().describe("The brand or manufacturer"),
  price: z.number().nullable().describe("The price as a number (without currency symbols)"),
  currency: z.string().nullable().describe("The currency code (USD, EUR, GBP, etc.)"),
  retailer: z.string().nullable().describe("The website or store name"),
  image_url: z.string().url().nullable().describe("The main product image URL"),
  category: z.string().nullable().describe("Product category (electronics, clothing, home, etc.)"),
  tags: z.array(z.string()).nullable().describe("Relevant tags or keywords"),
  attributes: z.record(z.unknown()).describe("Additional product-specific attributes (size, color, specs, etc.)"),
  confidence_score: z.number().min(0).max(1).describe("Confidence in extraction quality (0-1)"),
});

export type ProductExtraction = z.infer<typeof ProductExtractionSchema>;

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
}
