import type { ExtractionState } from '@/types/capture'

interface ExtractedItemCardProps {
  extractionState: ExtractionState
}

/**
 * Skeleton card (pulsing) during extraction
 * Smooth transition to real data when complete
 * Shows confidence badge if score < 0.7
 */
export function ExtractedItemCard({ extractionState }: ExtractedItemCardProps) {
  // Skeleton state while extracting
  if (extractionState.status === 'pending' || extractionState.status === 'in_progress') {
    return (
      <div className="w-full bg-slate-deep rounded-lg border border-slate-800 p-6 animate-pulse shadow-hard">
        {/* Image skeleton */}
        <div className="w-full h-48 bg-slate-800 rounded mb-4" />

        {/* Title skeleton */}
        <div className="h-6 bg-slate-800 rounded w-3/4 mb-3" />

        {/* Brand skeleton */}
        <div className="h-4 bg-slate-800 rounded w-1/2 mb-3" />

        {/* Price skeleton */}
        <div className="h-8 bg-slate-800 rounded w-1/3 mb-2" />

        {/* Type skeleton */}
        <div className="h-3 bg-slate-800 rounded w-1/4" />
      </div>
    )
  }

  // Failed state
  if (extractionState.status === 'failed') {
    return (
      <div className="w-full bg-red-900/20 rounded-lg border border-red-800 p-6">
        <p className="text-red-400 font-mono font-medium">
          Failed to extract item details
        </p>
        <p className="text-red-500 text-sm font-mono mt-1">
          {extractionState.error}
        </p>
      </div>
    )
  }

  // Complete state - show real data
  const { item, needsReview } = extractionState

  return (
    <div className="w-full bg-slate-deep rounded-lg border border-slate-800 p-6 animate-fade-in shadow-hard">
      {/* Low confidence badge */}
      {needsReview && (
        <div className="mb-4 p-3 bg-amber-900/20 border border-amber-800 rounded-lg">
          <p className="text-sm text-amber-200 font-mono flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Review needed:</strong> Low confidence extraction. Please verify the details below.
            </span>
          </p>
        </div>
      )}

      {/* Product image */}
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.title || 'Item image'}
          className="w-full h-48 object-contain mb-4 rounded"
        />
      )}

      {/* Product details */}
      <h3 className="text-xl font-mono font-semibold mb-2 text-white">
        {item.title}
      </h3>

      {item.brand && (
        <p className="text-slate-400 font-mono mb-2">{item.brand}</p>
      )}

      {item.price && item.currency && (
        <p className="text-2xl font-bold mb-2 text-open-green font-mono">
          {item.currency === 'USD' && '$'}
          {item.price.toLocaleString()}
          {item.currency !== 'USD' && ` ${item.currency}`}
        </p>
      )}

      {item.item_type && (
        <p className="text-sm text-slate-500 font-mono capitalize">
          {item.item_type}
        </p>
      )}

      {/* Retailer badge */}
      {item.retailer && (
        <div className="mt-3 inline-block px-3 py-1 bg-slate-800 rounded-full">
          <p className="text-xs text-slate-400 font-mono">
            from {item.retailer}
          </p>
        </div>
      )}
    </div>
  )
}
