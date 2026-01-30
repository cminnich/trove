'use client'

import { useState } from 'react'
import { useCollections } from '@/app/hooks/useCollections'
import { useStarredCollections } from '@/app/hooks/useStarredCollections'
import { CollectionGrid } from './components/CollectionGrid'
import { PublicCollectionCard } from './components/PublicCollectionCard'
import { EmptyState } from './components/EmptyState'
import { CreateCollectionSheet } from './components/CreateCollectionSheet'
import { useRouter } from 'next/navigation'

type TabType = 'my-collections' | 'starred'

export default function CollectionsPage() {
  const { collections, isLoading, isError, error, mutate } = useCollections()
  const { collections: starredCollections, isLoading: starredLoading, isError: starredError, error: starredErrorMsg } = useStarredCollections()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('my-collections')
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

          {/* Tabs */}
          <div className="flex items-center gap-2 mt-6 border-b border-slate-800">
            <button
              onClick={() => setActiveTab('my-collections')}
              className={`px-4 py-2 font-mono text-sm transition-colors border-b-2 ${
                activeTab === 'my-collections'
                  ? 'border-open-green text-open-green'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              My Troves
            </button>
            <button
              onClick={() => setActiveTab('starred')}
              className={`px-4 py-2 font-mono text-sm transition-colors border-b-2 ${
                activeTab === 'starred'
                  ? 'border-open-green text-open-green'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Starred
            </button>
          </div>
        </div>

        {/* Error State */}
        {activeTab === 'my-collections' && isError && (
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

        {activeTab === 'starred' && starredError && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-200 font-mono text-sm">
              <strong className="text-red-400">ERROR:</strong> {starredErrorMsg?.toString()}
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
        {activeTab === 'my-collections' && (
          <>
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
          </>
        )}

        {activeTab === 'starred' && (
          <>
            {!starredLoading && starredCollections.length === 0 && !starredError ? (
              <EmptyState
                icon="⭐"
                title="No starred collections"
                description="Star collections from other users to easily find them here."
              />
            ) : starredLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-slate-deep rounded-lg border border-slate-800 animate-pulse">
                    <div className="aspect-square bg-slate-800" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-slate-800 rounded w-3/4" />
                      <div className="h-3 bg-slate-800 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {starredCollections.map((collection) => (
                  <PublicCollectionCard
                    key={collection.id}
                    collection={collection}
                    isStarred={true}
                  />
                ))}
              </div>
            )}
          </>
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
