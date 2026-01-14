import { z } from "zod";

/**
 * Schema for AI-generated collection overview
 * Includes thematic analysis, strategic insights, and item relationships
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
  confidence_score: z.number().min(0).max(1),
});

export type CollectionOverview = z.infer<typeof CollectionOverviewSchema>;
