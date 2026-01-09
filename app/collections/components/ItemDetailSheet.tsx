'use client'

import { useState, useEffect } from 'react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ConfidenceBadge } from '@/app/components/ConfidenceBadge'
import { TagChipSelector } from './TagChipSelector'
import { ExternalLink, Save, X, Clock, FolderOpen, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { useUserCollections } from '@/app/hooks/useUserCollections'
import { useCollections } from '@/app/hooks/useCollections'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']
type Snapshot = Database['public']['Tables']['item_snapshots']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface ItemDetailSheetProps {
  open: boolean
  onClose: () => void
  item: ItemWithCollectionMetadata | null
  collectionId: string
  onUpdate?: () => void
}

export function ItemDetailSheet({ open, onClose, item, collectionId, onUpdate }: ItemDetailSheetProps) {
  const [editMode, setEditMode] = useState(false)
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(false)
  const [showPriceHistory, setShowPriceHistory] = useState(false)
  const [syncNotes, setSyncNotes] = useState(false)
  const [showCollectionsManager, setShowCollectionsManager] = useState(false)
  const [addingToCollection, setAddingToCollection] = useState(false)
  const [removingFromCollection, setRemovingFromCollection] = useState<string | null>(null)

  // Fetch user collections containing this item
  const { userCollections, mutate: mutateUserCollections, isLoading: loadingUserCollections } = useUserCollections(item?.id ?? null)

  // Fetch all user collections
  const { collections: allCollections } = useCollections()

  // Collection count: show at least 1 if we know it's in the current collection
  const collectionCount = loadingUserCollections ? 1 : Math.max(userCollections.length, 1)

  useEffect(() => {
    if (item) {
      setNotes(item.notes || '')
      setCategory(item.category || '')
      setTags(item.tags || [])
      setImageUrl(item.image_url || '')

      // Fetch snapshots for this item
      setLoadingSnapshots(true)
      fetch(`/api/items/${item.id}/snapshots`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setSnapshots(data.data)
          }
        })
        .catch(err => {
          console.error('Failed to fetch snapshots:', err)
        })
        .finally(() => {
          setLoadingSnapshots(false)
        })
    }
  }, [item])

  if (!item) return null

  // Check if notes are inconsistent across collections
  const hasInconsistentNotes = () => {
    if (userCollections.length <= 1) return false
    const uniqueNotes = new Set(userCollections.map(c => c.notes || ''))
    return uniqueNotes.size > 1
  }

  const notesAreInconsistent = hasInconsistentNotes()

  // Get collections not containing this item
  const availableCollections = allCollections.filter(
    c => !userCollections.find(uc => uc.id === c.id)
  )

  const needsReview = item.confidence_score !== null && item.confidence_score < 0.7

  const handleSave = async () => {
    setSaving(true)
    try {
      // Update item fields (category, tags, image_url)
      if (
        category !== item.category ||
        JSON.stringify(tags) !== JSON.stringify(item.tags || []) ||
        imageUrl !== (item.image_url || '')
      ) {
        await fetch(`/api/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, tags, image_url: imageUrl || null }),
        })
      }

      // Update notes
      if (notes !== (item.notes || '')) {
        if (syncNotes && userCollections.length > 0) {
          // Sync notes across all user collections
          const collectionIds = userCollections.map(c => c.id)
          await fetch(`/api/items/${item.id}/user-notes`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notes,
              collection_ids: collectionIds,
            }),
          })
        } else {
          // Update notes only for current collection
          await fetch(`/api/collections/${collectionId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item_id: item.id,
              notes,
            }),
          })
        }
      }

      setEditMode(false)
      mutateUserCollections()
      onUpdate?.()
    } catch (error) {
      console.error('Failed to update item:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSyncAllNotes = async () => {
    if (!userCollections.length) return
    setSaving(true)
    try {
      const collectionIds = userCollections.map(c => c.id)
      await fetch(`/api/items/${item.id}/user-notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          collection_ids: collectionIds,
        }),
      })
      mutateUserCollections()
      onUpdate?.()
    } catch (error) {
      console.error('Failed to sync notes:', error)
      alert('Failed to sync notes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddToCollection = async (targetCollectionId: string) => {
    setAddingToCollection(true)
    try {
      const response = await fetch(`/api/collections/${targetCollectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add item to collection')
      }

      // Wait for the mutation to complete before clearing loading state
      await mutateUserCollections()
      onUpdate?.()
    } catch (error) {
      console.error('Failed to add to collection:', error)
      alert('Failed to add item to collection. Please try again.')
    } finally {
      setAddingToCollection(false)
    }
  }

  const handleRemoveFromCollection = async (targetCollectionId: string) => {
    setRemovingFromCollection(targetCollectionId)
    try {
      const response = await fetch(`/api/collections/${targetCollectionId}/items/${item.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove item from collection')
      }

      // Wait for the mutation to complete before clearing loading state
      await mutateUserCollections()
      onUpdate?.()
    } catch (error) {
      console.error('Failed to remove from collection:', error)
      alert('Failed to remove item from collection. Please try again.')
    } finally {
      setRemovingFromCollection(null)
    }
  }

  const handleCancel = () => {
    setNotes(item.notes || '')
    setCategory(item.category || '')
    setTags(item.tags || [])
    setImageUrl(item.image_url || '')
    setEditMode(false)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Item Details">
      <div className="space-y-6" data-testid="item-detail-sheet">
        {/* Confidence Badge */}
        {needsReview && (
          <ConfidenceBadge score={item.confidence_score ?? undefined} needsReview={needsReview} size="md" />
        )}

        {/* Image */}
        {(item.image_url || imageUrl || editMode) && (
          <div className="w-full aspect-square max-h-96 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
            {(editMode && imageUrl) || item.image_url ? (
              <img
                src={editMode ? (imageUrl || item.image_url || '') : (item.image_url || '')}
                alt={item.title}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%239ca3af"%3EImage not found%3C/text%3E%3C/svg%3E'
                }}
              />
            ) : (
              <div className="text-center text-gray-400 p-8">
                <p className="text-sm">No image yet</p>
                <p className="text-xs mt-2">Add an image URL below</p>
              </div>
            )}
          </div>
        )}

        {/* Image URL - Editable */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Image URL
          </label>
          {editMode ? (
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="https://example.com/image.jpg"
            />
          ) : (
            <p className="text-gray-900 dark:text-gray-100 text-sm truncate">
              {item.image_url || <span className="text-gray-400">No image</span>}
            </p>
          )}
        </div>

        {/* Title & Brand */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {item.title}
          </h2>
          {item.brand && (
            <p className="text-lg text-gray-600 dark:text-gray-400">{item.brand}</p>
          )}
        </div>

        {/* Price */}
        {item.price && item.currency && (
          <div>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-mono">
              {item.currency === 'USD' && '$'}
              {item.price.toLocaleString()}
              {item.currency !== 'USD' && ` ${item.currency}`}
            </div>

            {/* Price History Indicator */}
            {snapshots.length > 1 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowPriceHistory(!showPriceHistory)}
                  className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Clock className="w-4 h-4" />
                  <span>{snapshots.length} price snapshots captured</span>
                </button>

                {/* Price History Display */}
                {showPriceHistory && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Price History</h3>
                    <div className="space-y-2">
                      {snapshots.map((snapshot, index) => {
                        const isLatest = index === 0
                        const capturedDate = new Date(snapshot.captured_at)
                        const previousSnapshot = snapshots[index + 1]
                        let priceChange: 'up' | 'down' | 'same' | null = null

                        if (previousSnapshot && snapshot.price !== null && previousSnapshot.price !== null) {
                          if (snapshot.price > previousSnapshot.price) {
                            priceChange = 'up'
                          } else if (snapshot.price < previousSnapshot.price) {
                            priceChange = 'down'
                          } else {
                            priceChange = 'same'
                          }
                        }

                        return (
                          <div
                            key={snapshot.id}
                            className={`flex items-center justify-between p-2 rounded ${isLatest ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-gray-900'}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                                  {snapshot.currency === 'USD' && '$'}
                                  {snapshot.price?.toLocaleString() || 'N/A'}
                                  {snapshot.currency !== 'USD' && snapshot.currency && ` ${snapshot.currency}`}
                                </span>
                                {priceChange === 'down' && (
                                  <span className="text-xs text-green-600 dark:text-green-400">↓ Price drop</span>
                                )}
                                {priceChange === 'up' && (
                                  <span className="text-xs text-red-600 dark:text-red-400">↑ Price increase</span>
                                )}
                                {isLatest && (
                                  <span className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded-full">Current</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {capturedDate.toLocaleDateString()} at {capturedDate.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Last Extracted Indicator */}
            {item.last_extracted_at && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Last captured: {new Date(item.last_extracted_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Category - Editable */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          {editMode ? (
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="e.g., Electronics"
            />
          ) : (
            <p className="text-gray-900 dark:text-gray-100">
              {item.category || <span className="text-gray-400">Not set</span>}
            </p>
          )}
        </div>

        {/* Tags - Editable */}
        {editMode ? (
          <TagChipSelector
            value={tags}
            onChange={setTags}
            disabled={saving}
          />
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {item.tags && item.tags.length > 0 ? (
                item.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-gray-400">No tags</span>
              )}
            </div>
          </div>
        )}

        {/* Item Type & Retailer */}
        <div className="grid grid-cols-2 gap-4">
          {item.item_type && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{item.item_type}</p>
            </div>
          )}
          {item.retailer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Retailer
              </label>
              <p className="text-gray-900 dark:text-gray-100">{item.retailer}</p>
            </div>
          )}
        </div>

        {/* Collections Manager */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={() => setShowCollectionsManager(!showCollectionsManager)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            data-testid="collections-manager-toggle"
          >
            <FolderOpen className="w-4 h-4" />
            <span>In {collectionCount} collection{collectionCount !== 1 ? 's' : ''}</span>
          </button>

          {showCollectionsManager && (
            <div className="mt-4 space-y-3">
              {/* Current Collections */}
              <div data-testid="current-collections">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  CURRENT COLLECTIONS
                </label>
                {loadingUserCollections ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-500">
                    Loading collections...
                  </div>
                ) : userCollections.length === 0 ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-500">
                    No collections found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userCollections.map((collection) => (
                      <div
                        key={collection.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                          {collection.name}
                        </span>
                        {userCollections.length > 1 && (
                          <button
                            onClick={() => handleRemoveFromCollection(collection.id)}
                            disabled={removingFromCollection === collection.id}
                            className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                            title="Remove from collection"
                            data-testid={`remove-from-${collection.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Collections */}
              {availableCollections.length > 0 && (
                <div data-testid="available-collections">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    ADD TO COLLECTION
                  </label>
                  <div className="space-y-2">
                    {availableCollections.map((collection) => (
                      <button
                        key={collection.id}
                        onClick={() => handleAddToCollection(collection.id)}
                        disabled={addingToCollection}
                        className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                        data-testid={`add-to-collection-${collection.name}`}
                      >
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {collection.name}
                        </span>
                        <Plus className="w-4 h-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collection Notes - Editable */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (Collection-Specific)
          </label>

          {/* Inconsistent Notes Warning */}
          {notesAreInconsistent && !editMode && (
            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg" data-testid="inconsistent-notes-warning">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                    Notes are inconsistent across your collections
                  </p>
                  <button
                    onClick={handleSyncAllNotes}
                    disabled={saving}
                    className="mt-2 text-xs text-amber-700 dark:text-amber-300 hover:underline disabled:opacity-50"
                    data-testid="sync-all-notes-button"
                  >
                    Sync all to this version
                  </button>
                </div>
              </div>
            </div>
          )}

          {editMode ? (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                placeholder="Add notes specific to this collection..."
                data-testid="notes-textarea"
              />

              {/* Sync Toggle */}
              {userCollections.length > 1 && (
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncNotes}
                    onChange={(e) => setSyncNotes(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    data-testid="sync-notes-checkbox"
                  />
                  <span>Sync note across my {userCollections.length} collections</span>
                </label>
              )}
            </>
          ) : (
            <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap" data-testid="item-notes">
              {item.notes || <span className="text-gray-400">No notes</span>}
            </p>
          )}
        </div>

        {/* Source URL */}
        {item.source_url && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source
            </label>
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="truncate max-w-xs">View original</span>
            </a>
          </div>
        )}

        {/* Confidence Score */}
        {item.confidence_score !== null && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Extraction Confidence
            </label>
            <p className="text-gray-900 dark:text-gray-100 font-mono">
              {Math.round(item.confidence_score * 100)}%
            </p>
          </div>
        )}

        {/* Attributes (JSONB) */}
        {item.attributes && Object.keys(item.attributes).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional Details
            </label>
            <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
              {JSON.stringify(item.attributes, null, 2)}
            </pre>
          </div>
        )}

        {/* Edit/Save Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                data-testid="save-item-button"
                data-saving={saving ? 'true' : undefined}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                data-testid="cancel-edit-button"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              data-testid="edit-item-button"
            >
              Edit Item
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
