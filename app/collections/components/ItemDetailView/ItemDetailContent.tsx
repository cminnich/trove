'use client'

import { useState, useEffect } from 'react'
import { ConfidenceBadge } from '@/app/components/ConfidenceBadge'
import { TagChipSelector } from '../TagChipSelector'
import { ShopNowButton } from '../ShopNowButton'
import {
  ExternalLink,
  Save,
  X,
  Clock,
  FolderOpen,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { useUserCollections } from '@/app/hooks/useUserCollections'
import { useCollections } from '@/app/hooks/useCollections'
import type { Database } from '@/types/database'
import { getItemDisplayTitle, formatUrlForDisplay } from '@/lib/url-formatter'
import { formatPrice } from '@/lib/price-formatter'
import { toast } from 'sonner'
import { AddToCollectionSheet } from './AddToCollectionSheet'
import { getClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Item = Database['public']['Tables']['items']['Row']
type Snapshot = Database['public']['Tables']['item_snapshots']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface ItemDetailContentProps {
  item: ItemWithCollectionMetadata
  collectionId: string
  isOwner: boolean
  onUpdate?: () => void
  onClose: () => void
}

export function ItemDetailContent({
  item,
  collectionId,
  isOwner,
  onUpdate,
  onClose,
}: ItemDetailContentProps) {
  const [editMode, setEditMode] = useState(false)
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [currency, setCurrency] = useState('USD')
  const [saving, setSaving] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(false)
  const [showPriceHistory, setShowPriceHistory] = useState(false)
  const [syncNotes, setSyncNotes] = useState(false)
  const [showCollectionsManager, setShowCollectionsManager] = useState(false)
  const [addingToCollection, setAddingToCollection] = useState(false)
  const [removingFromCollection, setRemovingFromCollection] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [showTrashConfirm, setShowTrashConfirm] = useState(false)
  const [trashing, setTrashing] = useState(false)
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  // Fetch user collections containing this item
  const {
    userCollections,
    mutate: mutateUserCollections,
    isLoading: loadingUserCollections,
  } = useUserCollections(item?.id ?? null)

  // Fetch all user collections
  const { collections: allCollections } = useCollections()

  // Collection count
  const collectionCount = loadingUserCollections ? 1 : Math.max(userCollections.length, 1)

  // Check user authentication status
  useEffect(() => {
    const checkUser = async () => {
      const supabase = getClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    checkUser()
  }, [])

  useEffect(() => {
    if (item) {
      setNotes(item.notes || '')
      setCategory(item.category || '')
      setTags(item.tags || [])
      setImageUrl(item.image_url || '')
      setPrice(item.price)
      setCurrency(item.currency || 'USD')

      // Fetch snapshots for this item
      setLoadingSnapshots(true)
      fetch(`/api/items/${item.id}/snapshots`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setSnapshots(data.data)
          }
        })
        .catch((err) => {
          console.error('Failed to fetch snapshots:', err)
        })
        .finally(() => {
          setLoadingSnapshots(false)
        })
    }
  }, [item])

  // Check if notes are inconsistent across collections
  const hasInconsistentNotes = () => {
    if (userCollections.length <= 1) return false
    const uniqueNotes = new Set(userCollections.map((c) => c.notes || ''))
    return uniqueNotes.size > 1
  }

  const notesAreInconsistent = hasInconsistentNotes()

  // Get collections not containing this item
  const availableCollections = allCollections.filter(
    (c) => !userCollections.find((uc) => uc.id === c.id)
  )

  const needsReview = item.confidence_score !== null && item.confidence_score < 0.7

  // Check if extraction needs retry
  const isStuck =
    item.extraction_status === 'processing' &&
    item.extraction_started_at &&
    new Date().getTime() - new Date(item.extraction_started_at).getTime() > 60000
  const needsRetry = item.extraction_status === 'failed' || isStuck

  const displayTitle = getItemDisplayTitle(item.title, item.source_url)
  const formattedUrl = formatUrlForDisplay(item.source_url, 50)

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const response = await fetch(`/api/items/${item.id}/re-extract`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        onUpdate?.()
        setTimeout(() => {
          onUpdate?.()
        }, 1000)
      } else {
        alert(data.error || 'Failed to retry extraction')
      }
    } catch (error) {
      console.error('Failed to retry extraction:', error)
      alert('Failed to retry extraction. Please try again.')
    } finally {
      setRetrying(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Update item fields (category, tags, image_url, price, currency)
      if (
        category !== item.category ||
        JSON.stringify(tags) !== JSON.stringify(item.tags || []) ||
        imageUrl !== (item.image_url || '') ||
        price !== item.price ||
        currency !== item.currency
      ) {
        await fetch(`/api/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            tags,
            image_url: imageUrl || null,
            price,
            currency,
          }),
        })
      }

      // Update notes
      if (notes !== (item.notes || '')) {
        if (syncNotes && userCollections.length > 0) {
          const collectionIds = userCollections.map((c) => c.id)
          await fetch(`/api/items/${item.id}/user-notes`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notes,
              collection_ids: collectionIds,
            }),
          })
        } else {
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
      const collectionIds = userCollections.map((c) => c.id)
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
    setPrice(item.price)
    setCurrency(item.currency || 'USD')
    setEditMode(false)
  }

  const handleMoveToTrash = async () => {
    setTrashing(true)
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to move item to trash')
      }

      onClose()

      const removedCollectionIds = data.data?.removed_from_collections || []
      toast.success('Item moved to Trash', {
        description: 'It will no longer appear in your collections.',
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              for (const cId of removedCollectionIds) {
                await fetch(`/api/collections/${cId}/items`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    item_id: item.id,
                    notes: item.notes || null,
                  }),
                })
              }
              toast.success('Item restored to collections')
              onUpdate?.()
            } catch (err) {
              console.error('Failed to restore item:', err)
              toast.error('Failed to restore item')
            }
          },
        },
        duration: 8000,
      })

      onUpdate?.()
    } catch (error) {
      console.error('Failed to move item to trash:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to move item to trash')
    } finally {
      setTrashing(false)
      setShowTrashConfirm(false)
    }
  }

  return (
    <div className="space-y-6 pb-safe">
      {/* Extraction Status & Retry */}
      {needsRetry && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                {item.extraction_status === 'failed'
                  ? 'Extraction failed'
                  : 'Extraction appears to be stuck'}
              </p>
              {item.extraction_error && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                  {item.extraction_error}
                </p>
              )}
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {retrying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Retry Extraction
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confidence Badge */}
      {needsReview && (
        <ConfidenceBadge
          score={item.confidence_score ?? undefined}
          needsReview={needsReview}
          size="md"
        />
      )}

      {/* Image */}
      {(item.image_url || imageUrl || editMode) && (
        <div className="w-full aspect-square max-h-80 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
          {(editMode && imageUrl) || item.image_url ? (
            <img
              src={editMode ? imageUrl || item.image_url || '' : item.image_url || ''}
              alt={item.title || 'Item image'}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%239ca3af"%3EImage not found%3C/text%3E%3C/svg%3E'
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

      {/* Image URL - Editable (only shown in edit mode) */}
      {editMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Image URL
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="https://example.com/image.jpg"
          />
        </div>
      )}

      {/* Title & Brand */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{displayTitle}</h2>
        {item.brand && <p className="text-lg text-gray-600 dark:text-gray-400">{item.brand}</p>}
      </div>

      {/* Shop Now Button */}
      {item.source_url && (
        <ShopNowButton
          sourceUrl={item.source_url}
          retailer={item.retailer}
        />
      )}

      {/* Price */}
      {editMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Price
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={price ?? ''}
              onChange={(e) => setPrice(e.target.value ? parseFloat(e.target.value) : null)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="19.99"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
              <option value="JPY">JPY</option>
            </select>
          </div>
        </div>
      )}

      {!editMode && item.price && item.currency && (
        <div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-mono">
            {formatPrice(item.price, item.currency)}
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
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Price History
                  </h3>
                  <div className="space-y-2">
                    {snapshots.map((snapshot, index) => {
                      const isLatest = index === 0
                      const capturedDate = new Date(snapshot.captured_at)
                      const previousSnapshot = snapshots[index + 1]
                      let priceChange: 'up' | 'down' | 'same' | null = null

                      if (
                        previousSnapshot &&
                        snapshot.price !== null &&
                        previousSnapshot.price !== null
                      ) {
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
                                {snapshot.currency !== 'USD' &&
                                  snapshot.currency &&
                                  ` ${snapshot.currency}`}
                              </span>
                              {priceChange === 'down' && (
                                <span className="text-xs text-green-600 dark:text-green-400">
                                  Price drop
                                </span>
                              )}
                              {priceChange === 'up' && (
                                <span className="text-xs text-red-600 dark:text-red-400">
                                  Price increase
                                </span>
                              )}
                              {isLatest && (
                                <span className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded-full">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {capturedDate.toLocaleDateString()} at{' '}
                              {capturedDate.toLocaleTimeString()}
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
        <TagChipSelector value={tags} onChange={setTags} disabled={saving} />
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
            <p className="text-gray-900 dark:text-gray-100 capitalize">
              {item.item_type === 'article' && !item.title
                ? formattedUrl || 'article'
                : item.item_type}
            </p>
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
        >
          <FolderOpen className="w-4 h-4" />
          <span>
            In {collectionCount} collection{collectionCount !== 1 ? 's' : ''}
          </span>
        </button>

        {showCollectionsManager && (
          <div className="mt-4 space-y-3">
            {/* Current Collections */}
            <div>
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
              <div>
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
          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
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
            />

            {/* Sync Toggle */}
            {userCollections.length > 1 && (
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncNotes}
                  onChange={(e) => setSyncNotes(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span>Sync note across my {userCollections.length} collections</span>
              </label>
            )}
          </>
        ) : (
          <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
            {item.notes || <span className="text-gray-400">No notes</span>}
          </p>
        )}
      </div>

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

      {/* Edit/Save Buttons - Owner Only */}
      {isOwner && (
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Edit Item
            </button>
          )}
        </div>
      )}

      {/* Danger Zone - Move to Trash (Owner Only) */}
      {isOwner && (
        <>
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Danger Zone
                  </h4>
                  <p className="text-xs text-red-800 dark:text-red-300">
                    Move this item to Trash. It will be removed from all your collections.
                  </p>
                </div>
                <button
                  onClick={() => setShowTrashConfirm(true)}
                  disabled={trashing}
                  className="flex-shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Trash
                </button>
              </div>
            </div>
          </div>

          {/* Trash Confirmation Dialog */}
          {showTrashConfirm && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 animate-fade-in"
            onClick={() => setShowTrashConfirm(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Move to Trash?
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This item will be removed from{' '}
                    <strong>
                      all {userCollections.length} collection{userCollections.length !== 1 ? 's' : ''}
                    </strong>
                    . It will no longer appear in your Trove.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    You can undo this action immediately after.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTrashConfirm(false)}
                  disabled={trashing}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveToTrash}
                  disabled={trashing}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {trashing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Moving...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Move to Trash
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          )}
        </>
      )}

      {/* Viewer Actions - Add to My Collection */}
      {!isOwner && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          {userId ? (
            <>
              <button
                onClick={() => setAddToCollectionOpen(true)}
                className="w-full px-6 py-3 border border-slate-800 hover:border-open-green bg-slate-deep hover:bg-slate-800 text-slate-300 hover:text-open-green rounded-lg font-mono font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add to My Collection
              </button>

              <AddToCollectionSheet
                isOpen={addToCollectionOpen}
                onClose={() => setAddToCollectionOpen(false)}
                itemId={item.id}
                itemName={item.title || 'Item'}
              />
            </>
          ) : (
            <div className="bg-slate-deep border border-slate-800 rounded-lg p-4 text-center">
              <p className="font-mono text-sm text-slate-400 mb-3">
                Log in to add items to your collection
              </p>
              <button
                onClick={() => {
                  const returnUrl = encodeURIComponent(window.location.pathname);
                  router.push(`/auth/login?returnTo=${returnUrl}`);
                }}
                className="px-6 py-2 bg-open-green hover:bg-emerald-400 text-void font-mono font-bold rounded-lg transition-colors"
              >
                Log In
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
