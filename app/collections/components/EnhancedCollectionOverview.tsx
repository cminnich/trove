"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Sparkles, RefreshCw, Loader2, ChevronDown, ChevronUp, Settings, X, RotateCcw, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  collectionId: string;
  isPrivate: boolean;
  isOwner?: boolean;
}

interface StructuredOverview {
  format: "structured_v1";
  summary: string;
  themes: string[];
  insights: Array<{ title: string; description: string }>;
  relationships?: Array<{
    item_ids: string[];
    relationship_type: string;
    description: string;
  }>;
  confidence_score: number;
}

function tryParseStructured(overview: string): StructuredOverview | null {
  try {
    const parsed = JSON.parse(overview);
    if (parsed.format === "structured_v1") return parsed;
    return null;
  } catch {
    return null;
  }
}

function StructuredOverviewView({ data }: { data: StructuredOverview }) {
  return (
    <div className="space-y-5">
      {/* Summary */}
      <p className="text-sm text-slate-300 leading-relaxed font-mono">
        {data.summary}
      </p>

      {/* Key Themes */}
      {data.themes && data.themes.length > 0 && (
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-slate-500 mb-3">
            # KEY_THEMES
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.themes.map((theme, i) => (
              <span
                key={i}
                className="inline-block px-3 py-1.5 text-sm font-mono text-open-green border border-open-green/40 rounded-md bg-open-green/5"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strategic Insights */}
      {data.insights && data.insights.length > 0 && (
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-slate-500 mb-3">
            # STRATEGIC_INSIGHTS
          </h2>
          <div className="space-y-3">
            {data.insights.map((insight, i) => (
              <div key={i} className="flex gap-2 text-sm font-mono">
                <span className="text-open-green flex-shrink-0 mt-0.5">&rarr;</span>
                <p className="text-slate-300 leading-relaxed">
                  <strong className="text-white font-medium">{insight.title}:</strong>{" "}
                  {insight.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item Relationships */}
      {data.relationships && data.relationships.length > 0 && (
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-slate-500 mb-3">
            # ITEM_RELATIONSHIPS
          </h2>
          <div className="space-y-3">
            {data.relationships.map((rel, i) => (
              <div key={i} className="flex gap-2 text-sm font-mono">
                <span className="text-open-green flex-shrink-0 mt-0.5">&rarr;</span>
                <p className="text-slate-300 leading-relaxed">
                  <strong className="text-white font-medium capitalize">
                    {rel.relationship_type}:
                  </strong>{" "}
                  {rel.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Score */}
      {data.confidence_score != null && (
        <>
          <hr className="border-slate-800" />
          <p className="font-mono text-xs text-slate-500">
            confidence_score:{" "}
            <span className="text-open-green">
              {Math.round(data.confidence_score * 100)}%
            </span>
          </p>
        </>
      )}
    </div>
  );
}

// Condensed height in pixels (approximately 3-4 lines)
const CONDENSED_HEIGHT = 120;

export function EnhancedCollectionOverview({ collectionId, isPrivate, isOwner = false }: Props) {
  const [overview, setOverview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [needsGeneration, setNeedsGeneration] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
  const [aiMode, setAiMode] = useState<string>("standard");

  // Collapsible state
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Configure dialog state
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [savedCustomPrompt, setSavedCustomPrompt] = useState(""); // Store saved prompt for reset
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<"current" | "standard" | "researcher" | "curator">("current");

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
      setHasCustomPrompt(!!data.has_custom_prompt);
      setAiMode(data.ai_mode || "standard");
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
        setHasCustomPrompt(!!data.has_custom_prompt);
        setAiMode(data.ai_mode || "standard");
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

  // Fetch collection's current custom prompt when dialog opens
  async function fetchCollectionPrompt() {
    try {
      const res = await fetch(`/api/collections/${collectionId}`);
      const data = await res.json();
      if (data.success && data.data) {
        const prompt = data.data.custom_prompt || "";
        setCustomPrompt(prompt);
        setSavedCustomPrompt(prompt); // Store for reset functionality
        setSelectedTemplate("current");
      }
    } catch (err) {
      console.error("Failed to fetch collection:", err);
    }
  }

  // Load template by name
  async function loadTemplate(templateName: "standard" | "researcher" | "curator") {
    const templateFiles: Record<string, string> = {
      standard: "collection_overview.txt",
      researcher: "researcher_mode.txt",
      curator: "curator_mode.txt",
    };

    try {
      setLoadingTemplate(true);
      const res = await fetch(`/api/prompts/${templateFiles[templateName]}`);
      const data = await res.json();
      if (data.success) {
        setCustomPrompt(data.content);
      }
    } catch (err) {
      console.error(`Failed to load ${templateName} template:`, err);
    } finally {
      setLoadingTemplate(false);
    }
  }

  // Handle template selection change
  function handleTemplateChange(newTemplate: "current" | "standard" | "researcher" | "curator") {
    if (newTemplate === "current") {
      setSelectedTemplate("current");
      return;
    }

    // If textarea has content and it differs from saved, confirm before overwriting
    if (customPrompt && customPrompt !== savedCustomPrompt) {
      const confirmed = window.confirm(
        "This will replace your current prompt. Continue?"
      );
      if (!confirmed) {
        return;
      }
    }

    setSelectedTemplate(newTemplate);
    loadTemplate(newTemplate);
  }

  // Reset to saved custom prompt
  function resetToSavedPrompt() {
    setCustomPrompt(savedCustomPrompt);
    setSelectedTemplate("current");
  }

  // Save custom prompt
  async function saveCustomPrompt() {
    try {
      setSavingPrompt(true);
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custom_prompt: customPrompt || null,
          ai_mode: "custom", // Switch to custom mode when saving custom prompt
        }),
      });
      const data = await res.json();
      if (data.success) {
        setHasCustomPrompt(!!customPrompt);
        setAiMode("custom");
        setSavedCustomPrompt(customPrompt);
        setShowConfigDialog(false);
        // Trigger regeneration immediately
        generateOverview();
      }
    } catch (err) {
      console.error("Failed to save custom prompt:", err);
    } finally {
      setSavingPrompt(false);
    }
  }

  // Reset to system default
  async function resetToDefault() {
    try {
      setSavingPrompt(true);
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custom_prompt: null,
          ai_mode: "standard", // Switch back to standard mode when clearing custom prompt
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomPrompt("");
        setSavedCustomPrompt("");
        setHasCustomPrompt(false);
        setAiMode("standard");
        setShowConfigDialog(false);
        // Trigger regeneration immediately
        generateOverview();
      }
    } catch (err) {
      console.error("Failed to reset prompt:", err);
    } finally {
      setSavingPrompt(false);
    }
  }

  // Open configure dialog
  function openConfigDialog() {
    fetchCollectionPrompt();
    setShowConfigDialog(true);
  }

  // Shimmer effect loading state - constrained to condensed height
  if (loading) {
    return (
      <div
        className="relative overflow-hidden bg-void border border-slate-800 rounded-md shadow-hard"
        style={{ maxHeight: CONDENSED_HEIGHT + 48 }} // 48px for padding
      >
        {/* Shimmer animation */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-slate-800/30 to-transparent" />
        <div className="font-mono text-xs uppercase tracking-widest text-slate-500 border-b border-slate-800 px-4 py-2">
          // COLLECTION_ANALYSIS.log
        </div>
        <div className="p-4 space-y-3">
          <div className="h-4 bg-slate-800/50 rounded w-full" />
          <div className="h-4 bg-slate-800/50 rounded w-3/4" />
          <div className="h-4 bg-slate-800/50 rounded w-1/2" />
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
      <div className="relative overflow-hidden bg-void border border-slate-800 rounded-md shadow-hard opacity-60">
        <div className="font-mono text-xs uppercase tracking-widest text-slate-600 border-b border-slate-800 px-4 py-2">
          // COLLECTION_ANALYSIS.log
        </div>
        <div className="p-4 flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded bg-slate-800 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-slate-600" />
          </div>
          <div className="font-mono">
            <p className="text-sm text-slate-500 mb-1">
              <span className="text-slate-600">[DISABLED]</span> AI analysis unavailable
            </p>
            <p className="text-xs text-slate-600">
              Collection is private. Make it public to enable AI-powered insights.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (needsGeneration) {
    return (
      <>
        <div className="relative overflow-hidden bg-void border border-slate-800 rounded-md shadow-hard">
          <div className="font-mono text-xs uppercase tracking-widest text-slate-500 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
            <span>// COLLECTION_ANALYSIS.log</span>
            {aiMode === "custom" && (
              <span className="text-open-green text-[10px]">[CUSTOM_AGENT]</span>
            )}
          </div>

          <div className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="font-mono">
                <p className="text-sm text-slate-300 mb-1">
                  <span className="text-slate-500">[READY]</span> Analysis available
                </p>
                <p className="text-xs text-slate-500">
                  Generate thematic insights, strategic analysis, and relationship mapping.
                </p>
              </div>
              {isOwner && (
                <button
                  onClick={openConfigDialog}
                  className="flex-shrink-0 text-xs font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                  title="Configure AI Agent"
                >
                  <Settings className="w-3 h-3" />
                  <span className="hidden sm:inline">config</span>
                </button>
              )}
            </div>
            {isOwner && (
              <button
                onClick={generateOverview}
                disabled={generating}
                className="w-full sm:w-auto bg-open-green hover:bg-emerald-400 disabled:bg-slate-700 text-void disabled:text-slate-400 px-6 py-2.5 rounded-md font-mono font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-hard"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Analysis
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Configure AI Agent Dialog */}
        {showConfigDialog && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-void border border-slate-800 rounded-lg shadow-hard max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Dialog Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div className="font-mono text-xs uppercase tracking-widest text-slate-500">
                  // CONFIGURE_CUSTOM_AGENT
                </div>
                <button
                  onClick={() => setShowConfigDialog(false)}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Dialog Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Template Selector */}
                <div>
                  <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                    load_template_from
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value as "current" | "standard" | "researcher" | "curator")}
                    disabled={loadingTemplate}
                    className="w-full px-4 py-2 text-sm font-mono bg-slate-deep border border-slate-800 rounded-md focus:ring-1 focus:ring-open-green focus:border-open-green text-slate-300"
                  >
                    <option value="current">Keep current content</option>
                    <option value="standard">Standard (General insights)</option>
                    <option value="researcher">Researcher (Gap analysis)</option>
                    <option value="curator">Curator (Redundancy detection)</option>
                  </select>
                </div>

                {/* Custom Prompt Textarea */}
                <div>
                  <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                    custom_prompt_template
                  </label>
                  <p className="text-xs font-mono text-slate-600 mb-3">
                    Variables: <code className="text-open-green">{"{{COLLECTION_NAME}}"}</code>, <code className="text-open-green">{"{{COLLECTION_DESCRIPTION}}"}</code>, <code className="text-open-green">{"{{COLLECTION_TYPE}}"}</code>, <code className="text-open-green">{"{{ITEM_COUNT}}"}</code>, <code className="text-open-green">{"{{ITEMS_JSON}}"}</code>
                  </p>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Enter your custom prompt or select a template to start from..."
                    className="w-full h-64 px-4 py-3 text-sm font-mono bg-slate-deep border border-slate-800 rounded-md focus:ring-1 focus:ring-open-green focus:border-open-green text-slate-300 placeholder-slate-600 resize-none"
                  />
                </div>

                {/* Reset to Saved Button (only shown if content differs from saved) */}
                {customPrompt !== savedCustomPrompt && savedCustomPrompt && (
                  <button
                    onClick={resetToSavedPrompt}
                    disabled={loadingTemplate}
                    className="flex items-center gap-2 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    reset_to_saved_custom_prompt
                  </button>
                )}
              </div>

              {/* Dialog Footer */}
              <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-deep/50">
                <button
                  onClick={resetToDefault}
                  disabled={savingPrompt || !savedCustomPrompt}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-mono text-slate-500 hover:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  clear_custom_prompt
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowConfigDialog(false)}
                    className="px-4 py-2 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    cancel
                  </button>
                  <button
                    onClick={saveCustomPrompt}
                    disabled={savingPrompt}
                    className="flex items-center gap-2 px-6 py-2 text-sm font-mono font-bold text-void bg-open-green hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 rounded-md shadow-hard transition-all"
                  >
                    {savingPrompt ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save & Regenerate"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!overview) {
    return null;
  }

  const currentHeight = isExpanded ? contentHeight : CONDENSED_HEIGHT;

  return (
    <div className="relative overflow-hidden bg-void border border-slate-800 rounded-md shadow-hard">
      {/* Terminal Header */}
      <div className="font-mono text-xs uppercase tracking-widest text-slate-500 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>// COLLECTION_ANALYSIS.log</span>
          {generating && (
            <span className="inline-flex items-center gap-1 text-open-green">
              <span className="animate-pulse">|</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasCustomPrompt && (
            <span className="text-open-green text-[10px]">[CUSTOM_AGENT]</span>
          )}
          {isOwner && (
            <>
              <button
                onClick={openConfigDialog}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="Configure AI Agent"
              >
                <Settings className="w-3 h-3" />
              </button>
              <button
                onClick={generateOverview}
                disabled={generating}
                className="text-slate-500 hover:text-open-green disabled:opacity-50 transition-colors"
                title="Refresh AI analysis"
              >
                {generating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4">
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
            {(() => {
              const structured = tryParseStructured(overview);
              if (structured) {
                return <StructuredOverviewView data={structured} />;
              }
              return (
                <article className="prose prose-invert prose-sm max-w-none font-mono
                  prose-headings:font-mono prose-headings:tracking-wider prose-headings:uppercase prose-headings:text-slate-300
                  prose-h1:text-base prose-h1:mb-3 prose-h1:border-b prose-h1:border-slate-800 prose-h1:pb-2
                  prose-h2:text-sm prose-h2:text-slate-400 prose-h2:mb-2 prose-h2:mt-4
                  prose-h3:text-xs prose-h3:text-slate-400 prose-h3:mb-1 prose-h3:mt-3
                  prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-3
                  prose-ul:text-slate-300 prose-ul:list-none prose-ul:pl-0
                  prose-li:text-sm prose-li:mb-2 prose-li:before:content-['→'] prose-li:before:text-open-green prose-li:before:mr-2
                  prose-strong:text-white prose-strong:font-medium
                  prose-code:text-open-green prose-code:bg-slate-800/50 prose-code:px-2 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                  prose-pre:bg-slate-800/50 prose-pre:border prose-pre:border-slate-700
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {overview}
                  </ReactMarkdown>
                </article>
              );
            })()}
          </div>
        </div>

        {/* Toggle Button - Only show if content needs truncation */}
        {needsTruncation && (
          <button
            onClick={toggleExpanded}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-mono text-slate-500 hover:text-open-green bg-slate-800/30 hover:bg-slate-800/50 rounded border border-slate-800 transition-all duration-200"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                [collapse]
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                [expand_full_analysis]
              </>
            )}
          </button>
        )}
      </div>

      {/* Configure AI Agent Dialog */}
      {showConfigDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-void border border-slate-800 rounded-lg shadow-hard max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="font-mono text-xs uppercase tracking-widest text-slate-500">
                // CONFIGURE_CUSTOM_AGENT
              </div>
              <button
                onClick={() => setShowConfigDialog(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dialog Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Template Selector */}
              <div>
                <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                  load_template_from
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value as "current" | "standard" | "researcher" | "curator")}
                  disabled={loadingTemplate}
                  className="w-full px-4 py-2 text-sm font-mono bg-slate-deep border border-slate-800 rounded-md focus:ring-1 focus:ring-open-green focus:border-open-green text-slate-300"
                >
                  <option value="current">Keep current content</option>
                  <option value="standard">Standard (General insights)</option>
                  <option value="researcher">Researcher (Gap analysis)</option>
                  <option value="curator">Curator (Redundancy detection)</option>
                </select>
              </div>

              {/* Custom Prompt Textarea */}
              <div>
                <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                  custom_prompt_template
                </label>
                <p className="text-xs font-mono text-slate-600 mb-3">
                  Variables: <code className="text-open-green">{"{{COLLECTION_NAME}}"}</code>, <code className="text-open-green">{"{{COLLECTION_DESCRIPTION}}"}</code>, <code className="text-open-green">{"{{COLLECTION_TYPE}}"}</code>, <code className="text-open-green">{"{{ITEM_COUNT}}"}</code>, <code className="text-open-green">{"{{ITEMS_JSON}}"}</code>
                </p>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Enter your custom prompt or select a template to start from..."
                  className="w-full h-64 px-4 py-3 text-sm font-mono bg-slate-deep border border-slate-800 rounded-md focus:ring-1 focus:ring-open-green focus:border-open-green text-slate-300 placeholder-slate-600 resize-none"
                />
              </div>

              {/* Reset to Saved Button (only shown if content differs from saved) */}
              {customPrompt !== savedCustomPrompt && savedCustomPrompt && (
                <button
                  onClick={resetToSavedPrompt}
                  disabled={loadingTemplate}
                  className="flex items-center gap-2 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  reset_to_saved_custom_prompt
                </button>
              )}
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-deep/50">
              <button
                onClick={resetToDefault}
                disabled={savingPrompt || !savedCustomPrompt}
                className="flex items-center gap-2 px-4 py-2 text-xs font-mono text-slate-500 hover:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                clear_custom_prompt
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowConfigDialog(false)}
                  className="px-4 py-2 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
                >
                  cancel
                </button>
                <button
                  onClick={saveCustomPrompt}
                  disabled={savingPrompt}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-mono font-bold text-void bg-open-green hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 rounded-md shadow-hard transition-all"
                >
                  {savingPrompt ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save & Regenerate"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
