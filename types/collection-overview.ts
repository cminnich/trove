import { z } from "zod";

/**
 * Schema for AI-discovered filter from item attributes
 */
export const DiscoveredFilterSchema = z.object({
  name: z.string(),
  display_name: z.string(),
  description: z.string().optional(),
  source_path: z.string(),
  value_type: z.enum(["string", "number", "numeric_range"]).default("string"),
  sample_values: z.array(z.string()),
  item_coverage: z.number().min(0).max(1),
  usefulness_score: z.number().min(0).max(1),
});

export type DiscoveredFilter = z.infer<typeof DiscoveredFilterSchema>;

/**
 * Schema for AI-generated collection overview
 * Includes thematic analysis, strategic insights, item relationships, and discovered filters
 */
export const CollectionOverviewSchema = z.object({
  summary: z.string(),
  themes: z.array(z.string()),
  insights: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    })
  ),
  relationships: z
    .array(
      z.object({
        item_ids: z.array(z.string().uuid()),
        relationship_type: z.string(),
        description: z.string(),
      })
    )
    .optional(),
  discovered_filters: z.array(DiscoveredFilterSchema).optional(),
  confidence_score: z.number().min(0).max(1),
});

export type CollectionOverview = z.infer<typeof CollectionOverviewSchema>;
