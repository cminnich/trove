'use client'

import { useEffect, useCallback, useMemo } from 'react'
import { X, Filter } from 'lucide-react'
import { useItemDetailStore } from '@/app/stores/useItemDetailStore'
import { useItemAttributes } from '@/app/hooks/useItemAttributes'
import { useFilteredCollectionItems } from '@/app/hooks/useFilteredCollectionItems'
import { useFilterPreferences } from '@/app/hooks/useFilterPreferences'
import { useCollectionAttributeSchemas } from '@/app/hooks/useCollectionAttributeSchemas'
import { SwipeNavigator } from './SwipeNavigator'
import { PositionIndicator } from './PositionIndicator'
import { ConnectionChips } from './ConnectionChips'
import { ItemDetailContent } from './ItemDetailContent'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface ItemDetailViewProps {
  items: ItemWithCollectionMetadata[]
  isOwner: boolean
  onUpdate?: () => void
}

export function ItemDetailView({ items, isOwner, onUpdate }: ItemDetailViewProps) {
  const {
    isOpen,
    itemId,
    collectionId,
    itemIndex,
    allItemIds,
    activeFilter,
    filteredItemIds,
    closeItemDetail,
    navigateToIndex,
    navigateNext,
    navigatePrev,
    setFilter,
    clearFilter,
  } = useItemDetailStore()

  // Get attributes for current item
  const { attributes, totalCollectionItems, isLoading: attributesLoading } = useItemAttributes(
    itemId,
    collectionId
  )

  // Get filter preferences for this collection
  const {
    preferences: filterPreferences,
    toggleFilter,
    resetFilter,
  } = useFilterPreferences(collectionId)

  // Get collection attribute schema management
  const { toggleSchemaVisibility } = useCollectionAttributeSchemas(collectionId)

  // Get filtered items when a filter is active
  const { items: filteredItems } = useFilteredCollectionItems(
    activeFilter ? collectionId : null,
    activeFilter
  )

  // Current item from the items array
  const currentItem = useMemo(() => {
    return items.find((item) => item.id === itemId) || null
  }, [items, itemId])

  // Navigation state
  const currentIds = filteredItemIds ?? allItemIds
  const currentIndex = itemIndex
  const totalCount = currentIds.length
  const canNavigatePrev = currentIndex > 0
  const canNavigateNext = currentIndex < totalCount - 1

  // Handle filter selection
  const handleFilterSelect = useCallback(
    (groupKey: string) => {
      // Fetch filtered items for this group key
      if (!collectionId) return

      fetch(
        `/api/collections/${collectionId}/items/by-attribute?group_key=${encodeURIComponent(groupKey)}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.items) {
            const itemIds = data.data.items.map((item: ItemWithCollectionMetadata) => item.id)
            setFilter(groupKey, itemIds)
          }
        })
        .catch((err) => {
          console.error('Failed to fetch filtered items:', err)
        })
    },
    [collectionId, setFilter]
  )

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeItemDetail()
      } else if (e.key === 'ArrowLeft' && canNavigatePrev) {
        navigatePrev()
      } else if (e.key === 'ArrowRight' && canNavigateNext) {
        navigateNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, canNavigatePrev, canNavigateNext, closeItemDetail, navigatePrev, navigateNext])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !currentItem || !collectionId) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Item details"
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <button
            onClick={closeItemDetail}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[200px] md:max-w-none">
            {currentItem.title || 'Item Details'}
          </h1>
        </div>

        {/* Filter indicator */}
        {activeFilter && (
          <button
            onClick={clearFilter}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtered</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Connection Chips */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <ConnectionChips
          attributes={attributes}
          activeFilter={activeFilter}
          onFilterSelect={handleFilterSelect}
          onFilterClear={clearFilter}
          isLoading={attributesLoading}
          totalCollectionItems={totalCollectionItems}
          filterPreferences={filterPreferences}
          onToggleFilter={toggleFilter}
          onResetFilter={resetFilter}
          onToggleCollectionSchema={toggleSchemaVisibility}
        />
      </div>

      {/* Swipeable Content Area */}
      <div className="flex-1 overflow-hidden">
        <SwipeNavigator
          onSwipeLeft={navigateNext}
          onSwipeRight={navigatePrev}
          canSwipeLeft={canNavigatePrev}
          canSwipeRight={canNavigateNext}
          currentIndex={currentIndex}
        >
          <div className="h-full overflow-y-auto px-4 py-4">
            <ItemDetailContent
              item={currentItem}
              collectionId={collectionId}
              isOwner={isOwner}
              onUpdate={onUpdate}
              onClose={closeItemDetail}
            />
          </div>
        </SwipeNavigator>
      </div>

      {/* Position Indicator */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <PositionIndicator
          currentIndex={currentIndex}
          totalCount={totalCount}
          onNavigate={navigateToIndex}
        />
        {/* Text indicator */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
          {currentIndex + 1} of {totalCount}
          {activeFilter && ' (filtered)'}
        </p>
      </div>
    </div>
  )
}
