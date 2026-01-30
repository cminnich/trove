import { z } from "zod";

// ============================================================================
// Zod Schemas for AI Mode Responses
// ============================================================================

/**
 * Researcher Mode Schema
 * Analyzes collection for gaps in the ontology and suggests items to fill them
 */
export const ResearcherSchema = z.object({
  missing_items: z.array(
    z.object({
      name: z.string().describe("Name of the missing item or category"),
      reason: z.string().describe("Why this item is missing and what gap it fills"),
      priority: z.enum(["high", "medium", "low"]).describe("How critical this gap is"),
    })
  ),
  recommendations: z.array(
    z.object({
      name: z.string().describe("Specific product recommendation"),
      price_estimate: z.string().describe("Estimated price range (e.g., '$50-100')"),
      reasoning: z.string().describe("Why this specific item is recommended"),
    })
  ),
});

export type ResearcherOutput = z.infer<typeof ResearcherSchema>;

/**
 * Curator Mode Schema
 * Identifies redundant or duplicate items and suggests maintenance actions
 */
export const CuratorSchema = z.object({
  redundant_groups: z.array(
    z.object({
      reason: z.string().describe("Why these items are considered redundant or overlapping"),
      item_ids: z.array(z.string().uuid()).describe("UUIDs of items in this redundant group"),
    })
  ),
  maintenance_suggestions: z.array(z.string()).describe("General collection health recommendations"),
});

export type CuratorOutput = z.infer<typeof CuratorSchema>;

// ============================================================================
// System Prompts for AI Modes
// ============================================================================

/**
 * Standard Mode System Prompt
 * Generates general insights and thematic analysis
 */
export const STANDARD_SYSTEM_PROMPT = `You are a helpful collection analyst. Analyze the provided items and generate insights about themes, patterns, and overall collection characteristics. Focus on what exists in the collection.

Be concise and insightful. Highlight interesting patterns and connections between items.`;

/**
 * Researcher Mode System Prompt
 * Focuses on gap analysis and collection completeness
 */
export const RESEARCHER_SYSTEM_PROMPT = `You are an expert buyer and researcher for this specific hobby or category. Your job is to analyze the collection to find gaps in the 'ontology' of this hobby.

Analyze what's present and identify what's conspicuously absent. Look for:
- Missing price tiers (e.g., all budget items but no flagship options)
- Missing brands that are industry standards
- Missing categories or use cases (e.g., everyday carry vs special occasion)
- Missing complementary items (e.g., accessories, tools, maintenance items)
- Style gaps (e.g., all modern, no vintage)

For each gap, explain WHY it matters and what functional or experiential need it would fill. Prioritize based on how critical the gap is to a well-rounded collection.

Then provide 2-3 specific product recommendations to fill the most important gaps, with reasoning and price estimates.`;

/**
 * Curator Mode System Prompt
 * Focuses on redundancy detection and collection optimization
 */
export const CURATOR_SYSTEM_PROMPT = `You are a strict collection curator. Your job is to identify redundancy and help streamline the collection.

Analyze the provided items AND their attributes (Brand, Color, Type, etc.) to find:
- Functionally identical items (e.g., multiple black leather wallets from different brands)
- Overlapping items that serve the same purpose (e.g., three field watches with similar specs)
- Items that differ only in superficial ways (e.g., same product in different colors)

For each redundant group, explain WHY they're redundant and what makes them functionally similar. Reference specific attributes like brand, color, material, price range.

Also provide general maintenance suggestions:
- Categories that are over-represented
- Items with missing or low-quality metadata
- Potential consolidation opportunities

Be direct and practical. The goal is a lean, intentional collection where every item serves a distinct purpose.`;

// ============================================================================
// Helper Functions for Formatting Output
// ============================================================================

/**
 * Format Researcher output to Markdown
 */
export function formatResearcherOutput(data: ResearcherOutput): string {
  let markdown = "# Collection Gap Analysis\n\n";

  if (data.missing_items.length > 0) {
    markdown += "## Missing Items\n\n";
    for (const item of data.missing_items) {
      const priorityEmoji = item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "🟢";
      markdown += `### ${priorityEmoji} ${item.name}\n`;
      markdown += `**Priority:** ${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}\n\n`;
      markdown += `${item.reason}\n\n`;
    }
  }

  if (data.recommendations.length > 0) {
    markdown += "## Recommended Items\n\n";
    for (const rec of data.recommendations) {
      markdown += `### ${rec.name}\n`;
      markdown += `**Estimated Price:** ${rec.price_estimate}\n\n`;
      markdown += `${rec.reasoning}\n\n`;
    }
  }

  return markdown;
}

/**
 * Format Curator output to Markdown
 */
export function formatCuratorOutput(data: CuratorOutput): string {
  let markdown = "# Collection Curation Report\n\n";

  if (data.redundant_groups.length > 0) {
    markdown += "## Redundant Items\n\n";
    markdown += `Found ${data.redundant_groups.length} group(s) of redundant or overlapping items:\n\n`;

    for (let i = 0; i < data.redundant_groups.length; i++) {
      const group = data.redundant_groups[i];
      markdown += `### Group ${i + 1}: ${group.item_ids.length} items\n`;
      markdown += `${group.reason}\n\n`;
      markdown += `**Item IDs:** ${group.item_ids.join(", ")}\n\n`;
    }
  } else {
    markdown += "## No Redundancies Found\n\n";
    markdown += "Great job! Your collection appears well-curated with minimal overlap.\n\n";
  }

  if (data.maintenance_suggestions.length > 0) {
    markdown += "## Maintenance Suggestions\n\n";
    for (const suggestion of data.maintenance_suggestions) {
      markdown += `- ${suggestion}\n`;
    }
    markdown += "\n";
  }

  return markdown;
}
