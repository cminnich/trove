"use client";

import { useEffect, useState } from "react";
import type { CollectionOverview as CollectionOverviewType } from "@/types/collection-overview";

interface Props {
  collectionId: string;
}

export function CollectionOverview({ collectionId }: Props) {
  const [overview, setOverview] = useState<CollectionOverviewType | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [needsGeneration, setNeedsGeneration] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverview();
  }, [collectionId]);

  async function fetchOverview() {
    try {
      setLoading(true);
      const res = await fetch(`/api/collections/${collectionId}/overview`);
      const data = await res.json();

      if (data.overview) {
        setOverview(data.overview);
        setNeedsGeneration(false);
      } else {
        setNeedsGeneration(true);
      }
    } catch (err) {
      console.error("Failed to fetch overview:", err);
      setError("Failed to load overview");
    } finally {
      setLoading(false);
    }
  }

  async function generateOverview() {
    try {
      setGenerating(true);
      setError(null);
      const res = await fetch(`/api/collections/${collectionId}/overview`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setOverview(data.overview);
        setNeedsGeneration(false);
      } else {
        setError(data.error || "Failed to generate overview");
      }
    } catch (err) {
      console.error("Failed to generate overview:", err);
      setError("Failed to generate overview");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  if (needsGeneration) {
    return (
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Generate AI Analysis
        </h3>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Get thematic insights, strategic analysis, and relationship mapping for this collection.
        </p>
        <button
          onClick={generateOverview}
          disabled={generating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {generating ? "Generating..." : "Generate Overview"}
        </button>
      </div>
    );
  }

  if (!overview) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          AI Curator's Analysis
        </h3>
        <button
          onClick={generateOverview}
          disabled={generating}
          className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
        >
          {generating ? "Regenerating..." : "Regenerate"}
        </button>
      </div>

      <p className="text-gray-700 dark:text-gray-300 mb-4">{overview.summary}</p>

      {overview.themes && overview.themes.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Key Themes
          </h4>
          <div className="flex flex-wrap gap-2">
            {overview.themes.map((theme, i) => (
              <span
                key={i}
                className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-3 py-1 rounded-full text-sm"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {overview.insights && overview.insights.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Strategic Insights
          </h4>
          <ul className="space-y-2">
            {overview.insights.map((insight, i) => (
              <li key={i} className="text-gray-700 dark:text-gray-300">
                <span className="font-medium text-gray-900 dark:text-white">
                  {insight.title}:
                </span>{" "}
                {insight.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {overview.relationships && overview.relationships.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Item Relationships
          </h4>
          <ul className="space-y-2 text-sm">
            {overview.relationships.map((rel, i) => (
              <li key={i} className="text-gray-700 dark:text-gray-300">
                <span className="font-medium capitalize">{rel.relationship_type}:</span>{" "}
                {rel.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        Confidence: {(overview.confidence_score * 100).toFixed(0)}%
      </div>
    </div>
  );
}
