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
      <div className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
        {/* Image skeleton */}
        <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded mb-4" />

        {/* Title skeleton */}
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />

        {/* Brand skeleton */}
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />

        {/* Price skeleton */}
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />

        {/* Type skeleton */}
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
      </div>
    )
  }

  // Failed state
  if (extractionState.status === 'failed') {
    return (
      <div className="w-full bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-6">
        <p className="text-red-700 dark:text-red-400 font-medium">
          Failed to extract item details
        </p>
        <p className="text-red-600 dark:text-red-500 text-sm mt-1">
          {extractionState.error}
        </p>
      </div>
    )
  }

  // Complete state - show real data
  const { item, needsReview } = extractionState

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-fade-in">
      {/* Low confidence badge */}
      {needsReview && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
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
          alt={item.title}
          className="w-full h-48 object-contain mb-4 rounded"
        />
      )}

      {/* Product details */}
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
        {item.title}
      </h3>

      {item.brand && (
        <p className="text-gray-600 dark:text-gray-400 mb-2">{item.brand}</p>
      )}

      {item.price && item.currency && (
        <p className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100 font-mono">
          {item.currency === 'USD' && '$'}
          {item.price.toLocaleString()}
          {item.currency !== 'USD' && ` ${item.currency}`}
        </p>
      )}

      {item.item_type && (
        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
          {item.item_type}
        </p>
      )}

      {/* Retailer badge */}
      {item.retailer && (
        <div className="mt-3 inline-block px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            from {item.retailer}
          </p>
        </div>
      )}
    </div>
  )
}
