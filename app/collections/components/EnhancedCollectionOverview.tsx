"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Sparkles, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { CollectionOverview as CollectionOverviewType } from "@/types/collection-overview";

interface Props {
  collectionId: string;
  isPrivate: boolean;
}

// Condensed height in pixels (approximately 3-4 lines)
const CONDENSED_HEIGHT = 120;

export function EnhancedCollectionOverview({ collectionId, isPrivate }: Props) {
  const [overview, setOverview] = useState<CollectionOverviewType | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [needsGeneration, setNeedsGeneration] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collapsible state
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOverview();
  }, [collectionId]);

  // Measure content height after overview loads
  useEffect(() => {
    if (overview && contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      setNeedsTruncation(height > CONDENSED_HEIGHT);
    }
  }, [overview]);

  // Re-measure on window resize
  useEffect(() => {
    const handleResize = () => {
      if (contentRef.current && overview) {
        const height = contentRef.current.scrollHeight;
        setContentHeight(height);
        setNeedsTruncation(height > CONDENSED_HEIGHT);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [overview]);

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
        // Reset expanded state for new content
        setIsExpanded(false);
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

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Shimmer effect loading state - constrained to condensed height
  if (loading) {
    return (
      <div
        className="relative overflow-hidden bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-pink-50/80 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-pink-950/30 backdrop-blur-sm rounded-2xl p-6 border border-indigo-200/50 dark:border-indigo-800/50"
        style={{ maxHeight: CONDENSED_HEIGHT + 48 }} // 48px for padding
      >
        {/* Shimmer animation */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent" />
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-200/50 dark:bg-indigo-800/50" />
            <div className="h-5 bg-indigo-200/50 dark:bg-indigo-800/50 rounded w-40" />
          </div>
          <div className="h-4 bg-indigo-200/50 dark:bg-indigo-800/50 rounded w-full" />
          <div className="h-4 bg-indigo-200/50 dark:bg-indigo-800/50 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
      </div>
    );
  }

  // Private collection warning - AI features disabled
  if (isPrivate && !overview) {
    return (
      <div className="relative overflow-hidden bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-300/50 dark:border-gray-700/50 opacity-60">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-gray-500 dark:text-gray-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-400 mb-2">
              AI Features Disabled
            </h3>
            <p className="text-gray-600 dark:text-gray-500 text-sm">
              This collection is private. Make it public to enable AI-powered insights and context sharing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (needsGeneration) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-pink-50/80 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-pink-950/30 backdrop-blur-sm rounded-2xl p-6 border border-indigo-200/50 dark:border-indigo-800/50">
        {/* Subtle animated gradient border effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-20 blur-sm animate-pulse" />

        <div className="relative">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                AI Curator's Analysis
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Get thematic insights, strategic analysis, and relationship mapping for this collection.
              </p>
            </div>
          </div>
          <button
            onClick={generateOverview}
            disabled={generating}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-indigo-400 disabled:to-purple-400 text-white px-6 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Overview
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (!overview) {
    return null;
  }

  const currentHeight = isExpanded ? contentHeight : CONDENSED_HEIGHT;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-pink-50/80 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-pink-950/30 backdrop-blur-sm rounded-2xl border border-indigo-200/50 dark:border-indigo-800/50">
      {/* Subtle animated gradient border effect */}
      <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-10 animate-pulse" />

      <div className="relative p-6">
        {/* Header - Always visible */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Curator's Analysis
            </h3>
          </div>
          <button
            onClick={generateOverview}
            disabled={generating}
            className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
            title="Refresh AI analysis"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{generating ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>

        {/* Collapsible Content Container */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: needsTruncation ? currentHeight : 'none',
          }}
        >
          {/* Content with fade mask when collapsed */}
          <div
            ref={contentRef}
            className={needsTruncation && !isExpanded ? 'mask-fade-bottom' : ''}
          >
            <p className="text-gray-800 dark:text-gray-200 mb-4 leading-relaxed font-mono text-sm">
              {overview.summary}
            </p>

            {overview.themes && overview.themes.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono">
                  Key Themes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {overview.themes.map((theme, i) => (
                    <span
                      key={i}
                      className="bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-sm border border-indigo-200/50 dark:border-indigo-700/50 font-mono"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {overview.insights && overview.insights.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono">
                  Strategic Insights
                </h4>
                <ul className="space-y-2">
                  {overview.insights.map((insight, i) => (
                    <li key={i} className="text-gray-800 dark:text-gray-200 text-sm font-mono">
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
              <div className="mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-800/50">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono">
                  Item Relationships
                </h4>
                <ul className="space-y-2 text-sm font-mono">
                  {overview.relationships.map((rel, i) => (
                    <li key={i} className="text-gray-800 dark:text-gray-200">
                      <span className="font-medium capitalize">{rel.relationship_type}:</span>{" "}
                      {rel.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-800/50 text-xs text-gray-600 dark:text-gray-400 font-mono">
              Confidence: {(overview.confidence_score * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Toggle Button - Only show if content needs truncation */}
        {needsTruncation && (
          <button
            onClick={toggleExpanded}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-white/40 dark:bg-gray-900/40 hover:bg-white/60 dark:hover:bg-gray-900/60 rounded-lg border border-indigo-200/50 dark:border-indigo-700/50 transition-all duration-200 active:scale-[0.98]"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Read Full Analysis
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
