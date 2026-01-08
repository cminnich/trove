'use client'

import type { Database } from '@/types/database'
import type { CaptureContext } from '@/types/capture'

type Collection = Database['public']['Tables']['collections']['Row']

interface CollectionSelectorProps {
  collections: Collection[]
  value: CaptureContext
  onChange: (context: CaptureContext) => void
  disabled?: boolean
  loading?: boolean
}

/**
 * Horizontal scrollable chip list for multi-select collections
 * Default "Inbox" pre-selected
 */
export function CollectionSelector({
  collections,
  value,
  onChange,
  disabled = false,
  loading = false
}: CollectionSelectorProps) {
  const toggleCollection = (collectionId: string) => {
    if (disabled) return

    const isSelected = value.selectedCollections.includes(collectionId)

    onChange({
      ...value,
      selectedCollections: isSelected
        ? value.selectedCollections.filter(id => id !== collectionId)
        : [...value.selectedCollections, collectionId],
      isDirty: true
    })
  }

  const isSelected = (collectionId: string) => value.selectedCollections.includes(collectionId)

  if (loading) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          File Under
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
        File Under
      </label>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {collections.map(collection => {
          const selected = isSelected(collection.id)
          return (
            <button
              key={collection.id}
              type="button"
              onClick={() => toggleCollection(collection.id)}
              disabled={disabled}
              className={`
                flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all
                ${
                  selected
                    ? 'bg-indigo-600 text-white border-2 border-indigo-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
                active:scale-95
              `}
            >
              {collection.type === 'inbox' && '📥 '}
              {collection.name}
            </button>
          )
        })}

        {/* TODO: Implement "Create New Collection" functionality */}
        <button
          type="button"
          disabled={disabled}
          className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + New
        </button>
      </div>

      {value.selectedCollections.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Select at least one collection (or add notes above)
        </p>
      )}
    </div>
  )
}
