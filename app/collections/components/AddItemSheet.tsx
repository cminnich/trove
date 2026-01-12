'use client'

import { useState, useEffect, useMemo } from 'react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Search, Plus, Loader2 } from 'lucide-react'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface AddItemSheetProps {
  open: boolean
  onClose: () => void
  collectionId: string
  onSuccess?: () => void
}

export function AddItemSheet({ open, onClose, collectionId, onSuccess }: AddItemSheetProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Fetch items when sheet opens
  useEffect(() => {
    if (open) {
      fetchItems()
      setSearchQuery('')
      setSelectedItems(new Set())
    }
  }, [open, collectionId])

  const fetchItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/user/items?excludeCollection=${collectionId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch items')
      }

      setItems(data.data || [])
    } catch (err) {
      console.error('Failed to fetch items:', err)
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items

    const query = searchQuery.toLowerCase()
    return items.filter(
      (item) =>
        item.title?.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query) ||
        item.retailer?.toLowerCase().includes(query) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(query))
    )
  }, [items, searchQuery])

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleAddItems = async () => {
    if (selectedItems.size === 0) return

    setAdding(true)
    setError(null)

    try {
      // Add each selected item to the collection
      const promises = Array.from(selectedItems).map((itemId) =>
        fetch(`/api/collections/${collectionId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId }),
        })
      )

      const results = await Promise.all(promises)

      // Check if any failed
      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        throw new Error(`Failed to add ${failed.length} item(s)`)
      }

      // Success!
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to add items:', err)
      setError(err instanceof Error ? err.message : 'Failed to add items')
    } finally {
      setAdding(false)
    }
  }

  const handleClose = () => {
    if (!adding) {
      setSearchQuery('')
      setSelectedItems(new Set())
      setError(null)
      onClose()
    }
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Add Items to Collection">
      <div className="space-y-4">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            disabled={loading || adding}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No items found matching your search' : 'No items available to add'}
            </p>
            {!searchQuery && items.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Extract some items first, then add them to collections
              </p>
            )}
          </div>
        )}

        {/* Items List */}
        {!loading && filteredItems.length > 0 && (
          <div className="space-y-2 overflow-y-auto">
            {filteredItems.map((item) => {
              const isSelected = selectedItems.has(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  disabled={adding}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left disabled:opacity-50 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Image */}
                  {item.image_url && (
                    <div className="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.title || ''}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.title || 'Untitled'}
                    </h3>
                    {item.brand && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{item.brand}</p>
                    )}
                    {item.price && item.currency && (
                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100 mt-1">
                        {item.currency === 'USD' && '$'}
                        {item.price.toLocaleString()}
                        {item.currency !== 'USD' && ` ${item.currency}`}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Action Buttons */}
        {!loading && filteredItems.length > 0 && (
          <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleClose}
              disabled={adding}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleAddItems}
              disabled={adding || selectedItems.size === 0}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {adding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
