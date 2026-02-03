"use client";

import { useState, useEffect } from "react";
import { BottomSheet } from "@/app/components/BottomSheet";
import {
  Settings,
  AlertTriangle,
  Trash2,
  Eye,
  EyeOff,
  Signal,
  Shield,
  Loader2,
  Check,
  Download,
  Link2,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface CollectionSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  collection: Collection;
  onUpdate: () => void;
  onDelete: () => void;
}

const COLLECTION_TYPES = [
  { value: "wishlist", label: "Wishlist" },
  { value: "inventory", label: "Inventory" },
  { value: "research", label: "Research" },
  { value: "shopping", label: "Shopping" },
  { value: "browsing", label: "Browsing" },
  { value: "other", label: "Other" },
];

export function CollectionSettingsDialog({
  open,
  onClose,
  collection,
  onUpdate,
  onDelete,
}: CollectionSettingsDialogProps) {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [type, setType] = useState(collection.type || "other");
  const [visibility, setVisibility] = useState<"public" | "private">(collection.visibility);
  const [aiMode, setAiMode] = useState<"standard" | "researcher" | "curator" | "custom">(collection.ai_mode);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Reset form when collection changes
  useEffect(() => {
    setName(collection.name);
    setDescription(collection.description || "");
    setType(collection.type || "other");
    setVisibility(collection.visibility);
    setAiMode(collection.ai_mode);
    setError(null);
    setSaveSuccess(false);
  }, [collection]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Collection name is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          type,
          visibility,
          ai_mode: aiMode,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update collection");
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onUpdate();
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Failed to update collection:", err);
      setError(err instanceof Error ? err.message : "Failed to update collection");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      const response = await fetch(`/api/collections/${collection.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete collection");
      }

      onDelete();
      onClose();
    } catch (err) {
      console.error("Failed to delete collection:", err);
      setError(err instanceof Error ? err.message : "Failed to delete collection");
      setShowDeleteConfirm(false);
    }
  };

  const handleCopyContextUrl = async () => {
    const contextUrl = `${window.location.origin}/api/v1/collections/${collection.id}/context?level=full`;
    try {
      await navigator.clipboard.writeText(contextUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      setError("Failed to copy URL to clipboard");
    }
  };

  const handleExport = (format: "json" | "csv") => {
    const url = `/api/collections/${collection.id}/export?format=${format}`;
    window.open(url, "_blank");
  };

  const handleClose = () => {
    if (!saving && !showDeleteConfirm) {
      setError(null);
      setSaveSuccess(false);
      onClose();
    }
  };

  return (
    <>
      <BottomSheet open={open && !showDeleteConfirm} onClose={handleClose} title="Collection Settings">
        <div className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {saveSuccess && (
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <p className="text-sm text-green-200">Settings saved successfully!</p>
            </div>
          )}

          {/* Section 1: General Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              General Info
            </h3>

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
                Collection Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                className="w-full px-4 py-2 border border-slate-800 rounded-lg bg-slate-deep text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                placeholder="My Collection"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                rows={3}
                className="w-full px-4 py-2 border border-slate-800 rounded-lg bg-slate-deep text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 resize-none"
                placeholder="Optional description..."
              />
            </div>

            {/* Type */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-slate-300 mb-1">
                Collection Type
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={saving}
                className="w-full px-4 py-2 border border-slate-800 rounded-lg bg-slate-deep text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              >
                {COLLECTION_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>

            {/* AI Persona */}
            <div>
              <label htmlFor="ai_mode" className="block text-sm font-medium text-slate-300 mb-1">
                AI Persona
              </label>
              <p className="text-xs text-slate-400 mb-2">
                Choose how AI analyzes this collection
              </p>
              <select
                id="ai_mode"
                value={aiMode}
                onChange={(e) => setAiMode(e.target.value as "standard" | "researcher" | "curator" | "custom")}
                disabled={saving}
                className="w-full px-4 py-2 border border-slate-800 rounded-lg bg-slate-deep text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="standard">Standard - General insights and themes</option>
                <option value="researcher">Researcher - Gap analysis and recommendations</option>
                <option value="curator">Curator - Redundancy detection and optimization</option>
                <option value="custom">Custom - Use your own custom prompt template</option>
              </select>

              {/* Show edit custom prompt notice when custom mode selected */}
              {aiMode === "custom" && (
                <div className="mt-2 bg-blue-900/20 border border-blue-800 rounded-lg p-3">
                  <p className="text-xs text-blue-300">
                    Custom mode requires a custom prompt. You can edit your custom prompt from the collection overview page.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Privacy & AI Access */}
          <div className="space-y-4 pt-6 border-t border-slate-800">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              {visibility === "public" ? (
                <Signal className="w-5 h-5 text-green-400" />
              ) : (
                <Shield className="w-5 h-5 text-slate-400" />
              )}
              Privacy & AI Access
            </h3>

            {/* Privacy Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label htmlFor="visibility" className="block text-sm font-medium text-slate-300">
                    Collection Privacy
                  </label>
                  <p className="text-xs text-slate-400 mt-1">
                    {visibility === "public"
                      ? "Visible to you and can be accessed by AI agents"
                      : "Only visible to you"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVisibility(visibility === "public" ? "private" : "public")}
                  disabled={saving}
                  className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                    visibility === "public"
                      ? "bg-green-500"
                      : "bg-slate-800"
                  }`}
                  aria-pressed={visibility === "public"}
                  aria-label="Toggle collection privacy"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                      visibility === "public" ? "translate-x-7" : "translate-x-0"
                    }`}
                  >
                    {visibility === "public" ? (
                      <Eye className="w-3 h-3 text-green-600" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-gray-600" />
                    )}
                  </span>
                </button>
              </div>

              {/* Privacy Warning */}
              {visibility === "private" && (
                <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-200 mb-1">
                      AI Features Disabled
                    </p>
                    <p className="text-xs text-amber-300">
                      Private collections cannot be accessed by AI Agents. This will disable the Context URL
                      and automated reasoning for this collection.
                    </p>
                  </div>
                </div>
              )}

              {/* Public Benefits */}
              {visibility === "public" && (
                <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 flex gap-3">
                  <Signal className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                      AI Connected
                    </p>
                    <p className="text-xs text-green-800 dark:text-green-300">
                      AI agents can analyze this collection, generate insights, and provide context-aware
                      recommendations.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Data & Export */}
          <div className="space-y-4 pt-6 border-t border-slate-800">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Download className="w-5 h-5" />
              Data & Export
            </h3>

            <p className="text-sm text-slate-400">
              Export your collection data for backups or use with external AI agents and tools.
            </p>

            {/* AI Context URL */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Full AI Context URL
              </label>
              <p className="text-xs text-slate-400 mb-2">
                Markdown + JSON hybrid format with full product metadata for AI agents
              </p>
              <button
                onClick={handleCopyContextUrl}
                className="w-full px-4 py-2 bg-slate-deep border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {copySuccess ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    Copy AI Context URL
                  </>
                )}
              </button>
            </div>

            {/* Legacy Export Options */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Legacy Export
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleExport("json")}
                  className="px-4 py-2 bg-slate-deep border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <FileJson className="w-4 h-4" />
                  JSON
                </button>
                <button
                  onClick={() => handleExport("csv")}
                  className="px-4 py-2 bg-slate-deep border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Danger Zone */}
          <div className="space-y-4 pt-6 border-t border-slate-800">
            <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </h3>

            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
                    Delete Collection
                  </h4>
                  <p className="text-xs text-red-800 dark:text-red-300">
                    This will remove the collection but will NOT delete the individual items within it.
                  </p>
                </div>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex-shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={handleClose}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-slate-800 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 animate-fade-in"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-slate-deep rounded-xl shadow-xl max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Delete Collection?
                </h3>
                <p className="text-sm text-slate-400">
                  Are you sure you want to delete "{collection.name}"? This will remove the collection but
                  will <strong>NOT</strong> delete the individual items within it.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-800 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
