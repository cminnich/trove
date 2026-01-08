import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface RecentlyTrovedProps {
  items: Item[]
  loading?: boolean
  onItemClick?: (itemId: string) => void
}

/**
 * Horizontal scrollable list of recently added items
 * Shows last 5 items with thumbnail, title, and price
 */
export function RecentlyTroved({ items, loading = false, onItemClick }: RecentlyTrovedProps) {
  if (loading) {
    return (
      <div className="w-full">
        <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
          Recently Troved
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="flex-shrink-0 w-32 h-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return null // Don't show section if no recent items
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
        Recently Troved
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick?.(item.id)}
            className="flex-shrink-0 w-32 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-indigo-400 transition-colors group"
          >
            {/* Thumbnail */}
            {item.image_url ? (
              <div className="w-full h-24 overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>
            ) : (
              <div className="w-full h-24 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-gray-400 text-2xl">📦</span>
              </div>
            )}

            {/* Details */}
            <div className="p-2">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
                {item.title}
              </p>
              {item.price && item.currency && (
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 font-mono">
                  {item.currency === 'USD' && '$'}
                  {item.price.toLocaleString()}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
