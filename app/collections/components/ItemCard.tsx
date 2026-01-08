import type { Database } from '@/types/database'
import { ConfidenceBadge } from '@/app/components/ConfidenceBadge'

type Item = Database['public']['Tables']['items']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface ItemCardProps {
  item: ItemWithCollectionMetadata
  variant?: 'grid' | 'list'
  onClick?: () => void
}

export function ItemCard({ item, variant = 'grid', onClick }: ItemCardProps) {
  const needsReview = item.confidence_score !== null && item.confidence_score < 0.7

  if (variant === 'list') {
    return (
      <button
        onClick={onClick}
        className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors p-4 text-left"
      >
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="text-2xl text-gray-300 dark:text-gray-600">📦</div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate">
              {item.title}
            </h3>
            {item.brand && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{item.brand}</p>
            )}
            {item.price && item.currency && (
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                {item.currency === 'USD' && '$'}
                {item.price.toLocaleString()}
                {item.currency !== 'USD' && ` ${item.currency}`}
              </p>
            )}
            <div className="flex gap-2 mt-2 flex-wrap">
              {item.category && (
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  {item.category}
                </span>
              )}
              {item.item_type && (
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded capitalize">
                  {item.item_type}
                </span>
              )}
              {needsReview && (
                <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded">
                  ⚠️ Review
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    )
  }

  // Grid variant
  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors p-4 text-left"
    >
      {/* Confidence Badge */}
      {needsReview && (
        <div className="mb-3">
          <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded">
            ⚠️ Review
          </span>
        </div>
      )}

      {/* Image */}
      <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center mb-3">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="text-6xl text-gray-300 dark:text-gray-600">📦</div>
        )}
      </div>

      {/* Details */}
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
        {item.title}
      </h3>

      {item.brand && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{item.brand}</p>
      )}

      {item.price && item.currency && (
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 font-mono mb-2">
          {item.currency === 'USD' && '$'}
          {item.price.toLocaleString()}
          {item.currency !== 'USD' && ` ${item.currency}`}
        </p>
      )}

      {item.item_type && (
        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
          {item.item_type}
        </p>
      )}
    </button>
  )
}
