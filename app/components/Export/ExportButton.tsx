"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown } from "lucide-react";

interface ExportButtonProps {
  collectionId: string;
  collectionName: string;
}

export function ExportButton({ collectionId, collectionName }: ExportButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleExport(format: "json" | "csv") {
    const url = `/api/collections/${collectionId}/export?format=${format}`;
    window.open(url, "_blank");
    setShowDropdown(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex-shrink-0 px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-slate-600 dark:hover:border-slate-500 transition-colors flex items-center gap-2 text-sm"
        title="Export collection data"
      >
        <Download className="w-4 h-4" />
        <span className="hidden lg:inline">Export</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-void border border-slate-800 rounded-lg shadow-hard overflow-hidden z-50">
          <button
            onClick={() => handleExport("json")}
            className="w-full px-4 py-3 text-left font-mono text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-3"
          >
            <span className="text-open-green">{"{}"}</span>
            Download as JSON
          </button>
          <button
            onClick={() => handleExport("csv")}
            className="w-full px-4 py-3 text-left font-mono text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-3 border-t border-slate-800"
          >
            <span className="text-open-green">,,,</span>
            Download as CSV
          </button>
        </div>
      )}
    </div>
  );
}
