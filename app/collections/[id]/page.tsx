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
import { ItemDetailView } from '../components/ItemDetailView'
import { AddItemSheet } from '../components/AddItemSheet'
import { EnhancedCollectionOverview } from '../components/EnhancedCollectionOverview'
import { CollectionSettingsDialog } from '../components/CollectionSettingsDialog'
import { ShareCollectionDialog } from '../components/ShareCollectionDialog'
import { useItemDetailStore } from '@/app/stores/useItemDetailStore'
import {
  ArrowLeft,
  SortAsc,
  GripVertical,
  X,
  Plus,
  Settings,
  Sparkles,
  Check,
  Share2,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { ForkButton, ForkBreadcrumb } from '@/app/components/Fork'
import { ExportButton } from '@/app/components/Export'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { getClient } from '@/lib/supabase-client'
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
  const router = useRouter()
  const [viewMode, setViewMode] = useViewPreference(id)
  const [sortOrder, setSortOrder] = useSortPreference(id)
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showEditToast, setShowEditToast] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [addItemSheetOpen, setAddItemSheetOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const { items, isLoading, isError, error, mutate, reorder } = useCollectionItems(id, sortOrder)
  const { isOpen, openItemDetail, closeItemDetail } = useItemDetailStore()

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = getClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    fetchUser()
  }, [])

  // Fetch collection metadata
  const { data: collectionData, mutate: mutateCollection } = useSWR<CollectionResponse>(
    `/api/collections/${id}`,
    fetcher
  )

  const collection = collectionData?.data
  const isOwner = !!(userId && collection?.owner_id === userId)

  // Get all item IDs for navigation
  const allItemIds = items.map(item => item.id)

  // Exit edit mode when sort order changes away from position
  useEffect(() => {
    if (sortOrder !== 'position' && editMode) {
      setEditMode(false)
    }
  }, [sortOrder, editMode])

  const handleItemClick = (item: any, index: number) => {
    if (!editMode) {
      openItemDetail(item.id, id, index, allItemIds)
    }
  }

  const handleAddItem = () => {
    setAddItemSheetOpen(true)
  }

  const handleItemUpdate = () => {
    // Revalidate items after update
    mutate()
    mutateCollection()
  }

  const handleEnterEditMode = () => {
    if (sortOrder !== 'position') {
      // Show toast notification
      showToastNotification('Switch to "Position" sort to reorder items')
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

    // Check if collection is private
    if (collection.visibility !== 'public') {
      showToastNotification('Collection must be public to share with AI. Update in Settings.')
      return
    }

    // Copy context URL to clipboard
    const contextUrl = `${window.location.origin}/api/v1/collections/${id}/context`
    try {
      await navigator.clipboard.writeText(contextUrl)
      showToastNotification('AI context URL copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      showToastNotification('Failed to copy URL to clipboard')
    }
  }

  const showToastNotification = (message: string) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const handleCollectionDeleted = () => {
    router.push('/collections')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Toast Notifications */}
      {showEditToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-100 dark:bg-amber-900/90 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 px-6 py-3 rounded-lg shadow-lg animate-fade-in">
          Switch to &quot;Position&quot; sort to reorder items
        </div>
      )}

      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in max-w-md">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{toastMessage}</span>
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

      {/* Header Section - Mobile First, Vertical Stacking */}
      <div className="mb-6 sm:mb-8">
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Collections</span>
        </Link>

        {/* Title & Description - Stacked Vertically */}
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {collection?.name || 'Loading...'}
          </h1>
          {/* Fork Breadcrumb - shows if this collection is a fork */}
          <ForkBreadcrumb collectionId={id} />
          {collection?.description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base mb-2 mt-2">
              {collection.description}
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {items.length} {items.length === 1 ? 'item' : 'items'}
            {collection?.type && (
              <span className="ml-2 text-gray-400">• {collection.type}</span>
            )}
            {collection && collection.fork_count > 0 && (
              <span className="ml-2 text-gray-400">• {collection.fork_count} {collection.fork_count === 1 ? 'fork' : 'forks'}</span>
            )}
          </p>
        </div>

        {/* Actions Row - Horizontal Scrolling on Mobile */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pb-2 sm:pb-0">
          {/* Fork Button - Show for public collections user doesn't own */}
          {collection && collection.visibility === 'public' && !isOwner && collection.is_forkable && (
            <ForkButton
              collectionId={id}
              collectionName={collection.name}
              itemCount={items.length}
            />
          )}

          {/* Add Existing Button - Only for owner */}
          {isOwner && (
            <button
              onClick={handleAddItem}
              className="flex-shrink-0 px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
              title="Add existing items to this collection"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Existing</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}

          {/* Share for AI Button */}
          {items.length > 0 && (
            <button
              onClick={handleShareForAI}
              className="flex-shrink-0 px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-indigo-500/30"
              title="Copy AI context URL to clipboard"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share for AI</span>
            </button>
          )}

          {/* Share with People Button - Only show for owner */}
          {isOwner && (
            <button
              onClick={() => setShareOpen(true)}
              className="flex-shrink-0 px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors flex items-center gap-2 text-sm"
              title="Share collection with collaborators"
            >
              <Users className="w-4 h-4" />
              <span className="hidden lg:inline">Share</span>
            </button>
          )}

          {/* Export Button */}
          {collection && (
            <ExportButton
              collectionId={id}
              collectionName={collection.name}
            />
          )}

          {/* Settings Button - Only for owner */}
          {isOwner && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex-shrink-0 px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors flex items-center gap-2 text-sm"
              title="Collection settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden lg:inline">Settings</span>
            </button>
          )}

          {/* Divider - Only for owner (before edit/sort controls) */}
          {isOwner && <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />}

          {/* Edit Button - Only show for owner when sort is position and view is grid */}
          {isOwner && sortOrder === 'position' && viewMode === 'grid' && !editMode && items.length > 0 && (
            <button
              onClick={handleEnterEditMode}
              className="flex-shrink-0 px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors flex items-center gap-2 text-sm"
              title="Reorder items"
            >
              <GripVertical className="w-4 h-4" />
              <span className="hidden lg:inline">Reorder</span>
            </button>
          )}

          {/* Sort Button - Only for owner */}
          {isOwner && (
            <button
              onClick={() => setSortSheetOpen(true)}
              disabled={editMode}
              className="flex-shrink-0 px-3 sm:px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              title="Sort items"
            >
              <SortAsc className="w-4 h-4" />
              <span className="hidden lg:inline">Sort</span>
            </button>
          )}

          {/* View Toggle */}
          <div className="flex-shrink-0">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* Enhanced AI Collection Overview */}
      {items.length > 0 && collection && (
        <div className="mb-6">
          <EnhancedCollectionOverview collectionId={id} isPrivate={collection.visibility === 'private'} isOwner={isOwner} />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200 text-sm">
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

      {/* Item Detail View (Full-screen with swipe navigation) */}
      <ItemDetailView items={items} onUpdate={handleItemUpdate} />

      {/* Add Item Sheet */}
      <AddItemSheet
        open={addItemSheetOpen}
        onClose={() => setAddItemSheetOpen(false)}
        collectionId={id}
        onSuccess={handleItemUpdate}
      />

      {/* Collection Settings Dialog */}
      {collection && (
        <CollectionSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          collection={collection}
          onUpdate={handleItemUpdate}
          onDelete={handleCollectionDeleted}
        />
      )}

      {/* Share Collection Dialog */}
      {collection && (
        <ShareCollectionDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          collection={collection}
        />
      )}
    </div>
  )
}
