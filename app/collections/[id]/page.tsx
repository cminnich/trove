'use client'

import { use } from 'react'
import { useCollectionItems } from '@/app/hooks/useCollectionItems'
import { useViewPreference } from '@/app/hooks/useViewPreference'
import { useSortPreference } from '@/app/hooks/useSortPreference'
import { ItemGrid } from '../components/ItemGrid'
import { ItemList } from '../components/ItemList'
import { SortableItemGrid } from '../components/SortableItemGrid'
import { ViewToggle } from '../components/ViewToggle'
import { EmptyState } from '../components/EmptyState'
import { SortSheet } from '../components/SortSheet'
import { ItemDetailSheet } from '../components/ItemDetailSheet'
import { useItemDetailStore } from '@/app/stores/useItemDetailStore'
import { ArrowLeft, SortAsc, GripVertical, X, Share2, Check } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import type { Database } from '@/types/database'

type Collection = Database['public']['Tables']['collections']['Row']

interface CollectionResponse {
  success: boolean
  data?: Collection
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [viewMode, setViewMode] = useViewPreference(id)
  const [sortOrder, setSortOrder] = useSortPreference(id)
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showEditToast, setShowEditToast] = useState(false)
  const [showShareToast, setShowShareToast] = useState(false)
  const [shareToastMessage, setShareToastMessage] = useState('')
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false)
  const { items, isLoading, isError, error, mutate, reorder } = useCollectionItems(id, sortOrder)
  const { isOpen, itemId, openItemDetail, closeItemDetail } = useItemDetailStore()
  const autoExitTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch collection metadata
  const { data: collectionData } = useSWR<CollectionResponse>(
    `/api/collections/${id}`,
    fetcher
  )

  const collection = collectionData?.data

  // Find the selected item
  const selectedItem = items.find(item => item.id === itemId)

  // Auto-exit edit mode after 5 seconds of inactivity
  useEffect(() => {
    if (editMode) {
      if (autoExitTimerRef.current) {
        clearTimeout(autoExitTimerRef.current)
      }
      autoExitTimerRef.current = setTimeout(() => {
        setEditMode(false)
      }, 5000)
    }
    return () => {
      if (autoExitTimerRef.current) {
        clearTimeout(autoExitTimerRef.current)
      }
    }
  }, [editMode, items]) // Reset timer when items change (drag happens)

  // Exit edit mode when sort order changes away from position
  useEffect(() => {
    if (sortOrder !== 'position' && editMode) {
      setEditMode(false)
    }
  }, [sortOrder, editMode])

  const handleItemClick = (item: any) => {
    if (!editMode) {
      openItemDetail(item.id, id)
    }
  }

  const handleAddItem = () => {
    console.log('Add item to collection')
    // TODO: Navigate to /add with collection pre-selected
  }

  const handleItemUpdate = () => {
    // Revalidate items after update
    mutate()
  }

  const handleEnterEditMode = () => {
    if (sortOrder !== 'position') {
      // Show toast notification
      setShowEditToast(true)
      setTimeout(() => setShowEditToast(false), 3000)
      return
    }
    setEditMode(true)
  }

  const handleExitEditMode = () => {
    setEditMode(false)
  }

  const handleReorder = async (itemPositions: Array<{ item_id: string; position: number }>) => {
    await reorder(itemPositions)
  }

  const handleShareForAI = async () => {
    if (!collection) return

    // Check if collection is public
    if (collection.visibility !== 'public') {
      setShowVisibilityDialog(true)
      return
    }

    // Generate the public URL
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const contextUrl = `${baseUrl}/api/v1/collections/${id}/context`

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(contextUrl)
      setShareToastMessage('Link copied to clipboard!')
      setShowShareToast(true)
      setTimeout(() => setShowShareToast(false), 3000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      setShareToastMessage('Failed to copy link')
      setShowShareToast(true)
      setTimeout(() => setShowShareToast(false), 3000)
    }
  }

  const handleMakePublic = async () => {
    try {
      // Update collection visibility to 'public'
      const response = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visibility: 'public',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update collection visibility')
      }

      // Revalidate collection data
      mutate()

      // Close dialog
      setShowVisibilityDialog(false)

      // Show success message and auto-share
      setShareToastMessage('Collection is now public!')
      setShowShareToast(true)
      setTimeout(() => {
        setShowShareToast(false)
        // Auto-trigger share after making public
        handleShareForAI()
      }, 1500)
    } catch (error) {
      console.error('Failed to make collection public:', error)
      setShareToastMessage('Failed to update collection')
      setShowShareToast(true)
      setTimeout(() => setShowShareToast(false), 3000)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Toast Notifications */}
      {showEditToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-100 dark:bg-amber-900/90 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 px-6 py-3 rounded-lg shadow-lg animate-fade-in">
          Switch to &quot;Position&quot; sort to reorder items
        </div>
      )}

      {showShareToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <Check className="w-5 h-5" />
          <span>{shareToastMessage}</span>
        </div>
      )}

      {/* Visibility Dialog */}
      {showVisibilityDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowVisibilityDialog(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Collection is Private
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This collection is currently private. To share it with AI agents, you can make it public or generate a secure share link.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleMakePublic}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Make Public
              </button>
              <button
                onClick={() => setShowVisibilityDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mode Banner */}
      {editMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4 animate-fade-in">
          <GripVertical className="w-5 h-5" />
          <span className="font-medium">Drag items to reorder</span>
          <button
            onClick={handleExitEditMode}
            className="ml-4 p-1 hover:bg-indigo-700 rounded transition-colors"
            aria-label="Exit edit mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Collections</span>
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {collection?.name || 'Loading...'}
            </h1>
            {collection?.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {collection.description}
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Share for AI Button */}
            <button
              onClick={handleShareForAI}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors flex items-center gap-2"
              title="Share collection context with AI agents"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Share for AI</span>
            </button>

            {/* Edit Button - Only show when sort is position and view is grid */}
            {sortOrder === 'position' && viewMode === 'grid' && !editMode && items.length > 0 && (
              <button
                onClick={handleEnterEditMode}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors flex items-center gap-2"
              >
                <GripVertical className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Reorder</span>
              </button>
            )}

            {/* Sort Button */}
            <button
              onClick={() => setSortSheetOpen(true)}
              disabled={editMode}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SortAsc className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Sort</span>
            </button>

            {/* View Toggle */}
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">
            <strong>Error loading items:</strong> {error?.toString()}
          </p>
        </div>
      )}

      {/* Content */}
      {!isLoading && items.length === 0 && !isError ? (
        <EmptyState
          icon="📦"
          title="This collection is empty"
          description="Add items to start organizing your collection."
          action={{
            label: 'Add Item',
            onClick: handleAddItem,
          }}
        />
      ) : viewMode === 'grid' ? (
        // Show SortableItemGrid only when sortOrder is 'position' (allows drag-and-drop)
        sortOrder === 'position' ? (
          <SortableItemGrid
            items={items}
            isLoading={isLoading}
            editMode={editMode}
            onItemClick={handleItemClick}
            onReorder={handleReorder}
          />
        ) : (
          <ItemGrid items={items} isLoading={isLoading} onItemClick={handleItemClick} />
        )
      ) : (
        <ItemList items={items} isLoading={isLoading} onItemClick={handleItemClick} />
      )}

      {/* Sort Sheet */}
      <SortSheet
        open={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        currentSort={sortOrder}
        onSortChange={setSortOrder}
      />

      {/* Item Detail Sheet */}
      <ItemDetailSheet
        open={isOpen}
        onClose={closeItemDetail}
        item={selectedItem || null}
        collectionId={id}
        onUpdate={handleItemUpdate}
      />
    </div>
  )
}
