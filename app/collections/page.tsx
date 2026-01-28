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
    <div className="min-h-screen bg-void">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-mono font-bold text-white tracking-wide mb-2">
            COLLECTIONS
          </h1>
          <p className="text-slate-400 font-mono text-sm">
            // Organize and browse your saved items
          </p>
        </div>

        {/* Error State */}
        {isError && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-200 font-mono text-sm">
              <strong className="text-red-400">ERROR:</strong> {error?.toString()}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-red-400 hover:text-red-300 font-mono"
            >
              [RETRY]
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
            className="fixed bottom-24 md:bottom-8 right-6 w-14 h-14 bg-open-green hover:bg-emerald-400 text-void rounded-lg shadow-hard flex items-center justify-center transition-all hover:scale-105 z-40"
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
    </div>
  )
}
