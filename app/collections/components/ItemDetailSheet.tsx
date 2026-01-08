'use client'

import { useState, useEffect } from 'react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ConfidenceBadge } from '@/app/components/ConfidenceBadge'
import { TagChipSelector } from './TagChipSelector'
import { ExternalLink, Save, X } from 'lucide-react'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setNotes(item.notes || '')
      setCategory(item.category || '')
      setTags(item.tags || [])
    }
  }, [item])

  if (!item) return null

  const needsReview = item.confidence_score !== null && item.confidence_score < 0.7

  const handleSave = async () => {
    setSaving(true)
    try {
      // Update item fields (category, tags)
      if (category !== item.category || JSON.stringify(tags) !== JSON.stringify(item.tags || [])) {
        await fetch(`/api/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, tags }),
        })
      }

      // Update collection-specific notes
      if (notes !== (item.notes || '')) {
        await fetch(`/api/collections/${collectionId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: item.id,
            notes,
          }),
        })
      }

      setEditMode(false)
      onUpdate?.()
    } catch (error) {
      console.error('Failed to update item:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setNotes(item.notes || '')
    setCategory(item.category || '')
    setTags(item.tags || [])
    setEditMode(false)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Item Details">
      <div className="space-y-6">
        {/* Confidence Badge */}
        {needsReview && (
          <ConfidenceBadge score={item.confidence_score ?? undefined} needsReview={needsReview} size="md" />
        )}

        {/* Image */}
        {item.image_url && (
          <div className="w-full aspect-square max-h-96 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-full object-contain"
            />
          </div>
        )}

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
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-mono">
            {item.currency === 'USD' && '$'}
            {item.price.toLocaleString()}
            {item.currency !== 'USD' && ` ${item.currency}`}
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

        {/* Collection Notes - Editable */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (Collection-Specific)
          </label>
          {editMode ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
              placeholder="Add notes specific to this collection..."
            />
          ) : (
            <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
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
      </div>
    </BottomSheet>
  )
}
