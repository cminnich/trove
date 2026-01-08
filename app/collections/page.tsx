'use client'

import { useState } from 'react'
import { useCollections } from '@/app/hooks/useCollections'
import { CollectionGrid } from './components/CollectionGrid'
import { EmptyState } from './components/EmptyState'
import { CreateCollectionSheet } from './components/CreateCollectionSheet'
import { useRouter } from 'next/navigation'

export default function CollectionsPage() {
  const { collections, isLoading, isError, error, mutate } = useCollections()
  const router = useRouter()
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)

  const handleCreateCollection = () => {
    setIsCreateSheetOpen(true)
  }

  const handleCreateSuccess = () => {
    // Refresh collections data after successful creation
    mutate()
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Collections
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Organize and browse your saved items
        </p>
      </div>

      {/* Error State */}
      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">
            <strong>Error loading collections:</strong> {error?.toString()}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Content */}
      {!isLoading && collections.length === 0 && !isError ? (
        <EmptyState
          icon="📚"
          title="No collections yet"
          description="Start organizing your items by creating your first collection."
          action={{
            label: 'Create Collection',
            onClick: handleCreateCollection,
          }}
        />
      ) : (
        <CollectionGrid collections={collections} isLoading={isLoading} />
      )}

      {/* Floating Create Button - shown when collections exist */}
      {!isLoading && collections.length > 0 && (
        <button
          onClick={handleCreateCollection}
          className="fixed bottom-24 md:bottom-8 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-40"
          aria-label="Create new collection"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Create Collection Sheet */}
      <CreateCollectionSheet
        open={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}
