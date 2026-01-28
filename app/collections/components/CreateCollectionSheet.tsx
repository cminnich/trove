'use client'

import { useState, FormEvent } from 'react'
import { BottomSheet } from '@/app/components/BottomSheet'

interface CreateCollectionSheetProps {
  open: boolean
  onClose: () => void
  onSuccess: (collection?: { id: string; name: string }) => void
}

export function CreateCollectionSheet({
  open,
  onClose,
  onSuccess,
}: CreateCollectionSheetProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Collection name is required')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type: type || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create collection')
      }

      // Reset form
      setName('')
      setDescription('')
      setType('')
      setError(null)

      // Notify parent component of success with the created collection
      const createdCollection = data.data
      onSuccess(createdCollection ? { id: createdCollection.id, name: createdCollection.name } : undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setName('')
      setDescription('')
      setType('')
      setError(null)
      onClose()
    }
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Create Collection">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-200 font-mono">{error}</p>
          </div>
        )}

        {/* Name Field */}
        <div>
          <label
            htmlFor="collection-name"
            className="block text-sm font-mono font-medium text-slate-300 mb-1"
          >
            Name <span className="text-red-400">*</span>
          </label>
          <input
            id="collection-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., My Wishlist"
            disabled={isSubmitting}
            className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-2 focus:ring-open-green focus:border-transparent bg-slate-800 text-white font-mono placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
            autoComplete="off"
            required
          />
        </div>

        {/* Description Field */}
        <div>
          <label
            htmlFor="collection-description"
            className="block text-sm font-mono font-medium text-slate-300 mb-1"
          >
            Description
          </label>
          <textarea
            id="collection-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this collection for?"
            rows={3}
            disabled={isSubmitting}
            className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-2 focus:ring-open-green focus:border-transparent bg-slate-800 text-white font-mono placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          />
        </div>

        {/* Type Field */}
        <div>
          <label
            htmlFor="collection-type"
            className="block text-sm font-mono font-medium text-slate-300 mb-1"
          >
            Type
          </label>
          <select
            id="collection-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-4 py-2 border border-slate-700 rounded-lg focus:ring-2 focus:ring-open-green focus:border-transparent bg-slate-800 text-white font-mono disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Choose a type (optional)</option>
            <option value="wishlist">Wishlist</option>
            <option value="inventory">Inventory</option>
            <option value="research">Research</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="flex-1 px-4 py-2 bg-open-green hover:bg-emerald-400 text-void rounded-lg transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </>
            ) : (
              'Create'
            )}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
