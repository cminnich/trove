'use client'

import { useState } from 'react'

interface ProductSearchResult {
  url: string
  title: string
  snippet: string
  domain: string
}

interface PhotoIdentificationItem {
  title: string
  brand: string | null
  item_type: string
  category: string | null
  search_query: string
  confidence_score: number
  distinguishing_features: string
}

interface IdentifiedItem {
  identification: PhotoIdentificationItem
  candidates: ProductSearchResult[]
}

interface PhotoBatchResultsProps {
  items: IdentifiedItem[]
  sceneDescription: string
  onSelectUrl: (url: string) => void
  onCreateWithoutUrl: (item: PhotoIdentificationItem) => void
  onCancel: () => void
}

function ConfidenceBadge({ score }: { score: number }) {
  const label = score >= 0.9 ? 'HIGH' : score >= 0.7 ? 'MED' : 'LOW'
  const color = score >= 0.9
    ? 'text-open-green border-open-green/30'
    : score >= 0.7
      ? 'text-yellow-400 border-yellow-400/30'
      : 'text-red-400 border-red-400/30'

  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 border rounded ${color}`}>
      {label}
    </span>
  )
}

function ItemResult({
  item,
  onSelectUrl,
  onCreateWithoutUrl,
}: {
  item: IdentifiedItem
  onSelectUrl: (url: string) => void
  onCreateWithoutUrl: (item: PhotoIdentificationItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { identification, candidates } = item
  const hasResults = candidates.length > 0
  const topCandidate = candidates[0]

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-deep overflow-hidden">
      {/* Item header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ConfidenceBadge score={identification.confidence_score} />
            <span className="text-[10px] font-mono text-slate-500 uppercase">
              {identification.item_type}
            </span>
          </div>
          <p className="text-sm font-mono text-white truncate">
            {identification.title}
          </p>
          {identification.brand && (
            <p className="text-xs font-mono text-slate-400">{identification.brand}</p>
          )}
        </div>
      </div>

      {/* Top match or no-match state */}
      {hasResults ? (
        <div className="px-4 pb-3 space-y-2">
          {/* Primary action: use top candidate */}
          <button
            onClick={() => onSelectUrl(topCandidate.url)}
            className="w-full text-left px-3 py-2 rounded border border-slate-700 hover:border-open-green bg-void transition-colors group"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-slate-300 truncate group-hover:text-white">
                  {topCandidate.title}
                </p>
                <p className="text-[10px] font-mono text-slate-500">
                  {topCandidate.domain}
                </p>
              </div>
              <span className="text-open-green text-xs font-mono shrink-0">
                Add &rarr;
              </span>
            </div>
          </button>

          {/* Alternative results */}
          {candidates.length > 1 && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
              >
                {expanded ? '- hide alternatives' : `+ ${candidates.length - 1} more result${candidates.length > 2 ? 's' : ''}`}
              </button>

              {expanded && (
                <div className="space-y-1">
                  {candidates.slice(1).map((c, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectUrl(c.url)}
                      className="w-full text-left px-3 py-2 rounded border border-slate-800 hover:border-slate-600 bg-void transition-colors group"
                    >
                      <p className="text-xs font-mono text-slate-400 truncate group-hover:text-slate-200">
                        {c.title}
                      </p>
                      <p className="text-[10px] font-mono text-slate-600">
                        {c.domain}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="px-4 pb-3">
          <p className="text-xs font-mono text-slate-500 mb-2">
            No product listings found online
          </p>
          <button
            onClick={() => onCreateWithoutUrl(identification)}
            className="text-xs font-mono text-open-green hover:text-emerald-400 transition-colors"
          >
            Create from photo data &rarr;
          </button>
        </div>
      )}
    </div>
  )
}

export function PhotoBatchResults({
  items,
  sceneDescription,
  onSelectUrl,
  onCreateWithoutUrl,
  onCancel,
}: PhotoBatchResultsProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            // Identified {items.length} item{items.length !== 1 ? 's' : ''}
          </h3>
          {sceneDescription && (
            <p className="text-xs font-mono text-slate-600 mt-1">{sceneDescription}</p>
          )}
        </div>
        <button
          onClick={onCancel}
          className="text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {items.map((item, i) => (
          <ItemResult
            key={i}
            item={item}
            onSelectUrl={onSelectUrl}
            onCreateWithoutUrl={onCreateWithoutUrl}
          />
        ))}
      </div>
    </div>
  )
}
