'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

type AddState =
  | { status: 'idle' }
  | { status: 'extracting' }
  | { status: 'success'; item: Item; isDuplicate?: boolean; needsReview?: boolean }
  | { status: 'error'; error: string; canRetry?: boolean }

function AddPageContent() {
  const searchParams = useSearchParams()
  const urlParam = searchParams?.get('url')
  const [state, setState] = useState<AddState>({ status: 'idle' })
  const [urlInput, setUrlInput] = useState('')

  // Auto-submit if URL param present (iOS Shortcut entry)
  useEffect(() => {
    if (urlParam && state.status === 'idle') {
      submitUrl(urlParam)
    }
  }, [urlParam, state.status])

  const submitUrl = async (url: string) => {
    setState({ status: 'extracting' })

    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      const data = await response.json()

      if (!response.ok) {
        setState({
          status: 'error',
          error: data.error || 'Failed to add item',
          canRetry: true
        })
        return
      }

      if (data.duplicate) {
        setState({
          status: 'success',
          item: data.data,
          isDuplicate: true
        })
        return
      }

      // Check needs_review flag from extraction
      const needsReview = data.data.item.confidence_score < 0.7

      setState({
        status: 'success',
        item: data.data.item,
        needsReview
      })
    } catch (error) {
      setState({
        status: 'error',
        error: 'Network error. Please try again.',
        canRetry: true
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (urlInput.trim()) {
      submitUrl(urlInput.trim())
    }
  }

  const handleReset = () => {
    setState({ status: 'idle' })
    setUrlInput('')
  }

  // Render different states
  if (state.status === 'extracting') {
    return <LoadingView />
  }

  if (state.status === 'success') {
    return (
      <SuccessView
        item={state.item}
        isDuplicate={state.isDuplicate}
        needsReview={state.needsReview}
        onAddAnother={handleReset}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <ErrorView
        error={state.error}
        onRetry={state.canRetry ? () => submitUrl(urlInput || urlParam || '') : undefined}
        onReset={handleReset}
      />
    )
  }

  // Idle state - show form
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-center">Add to Trove</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-center">
          Save items from any URL
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium mb-2">
              Product URL
            </label>
            <input
              type="url"
              id="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Add Item
          </button>
        </form>
      </div>
    </main>
  )
}

// Wrap in Suspense for useSearchParams
export default function AddPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <AddPageContent />
    </Suspense>
  )
}

// Loading View Component
function LoadingView() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="text-center">
        {/* Spinner */}
        <div className="inline-block w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 rounded-full animate-spin mb-4"></div>

        <h2 className="text-2xl font-semibold mb-2">Extracting product details...</h2>
        <p className="text-gray-600 dark:text-gray-400">This may take a few seconds</p>
      </div>
    </main>
  )
}

// Success View Component
function SuccessView({
  item,
  isDuplicate,
  needsReview,
  onAddAnother
}: {
  item: Item
  isDuplicate?: boolean
  needsReview?: boolean
  onAddAnother: () => void
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Success header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">✓</div>
          <h2 className="text-2xl font-bold">
            {isDuplicate ? 'Already in Trove' : 'Added to Trove'}
          </h2>
        </div>

        {/* Low confidence warning */}
        {needsReview && !isDuplicate && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Low confidence extraction. Please verify the details below.
            </p>
          </div>
        )}

        {/* Item card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          {/* Product image */}
          {item.image_url && (
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-48 object-contain mb-4 rounded"
            />
          )}

          {/* Product details */}
          <h3 className="text-xl font-semibold mb-2">{item.title}</h3>

          {item.brand && (
            <p className="text-gray-600 dark:text-gray-400 mb-2">{item.brand}</p>
          )}

          {item.price && item.currency && (
            <p className="text-2xl font-bold mb-2">
              {item.currency === 'USD' && '$'}
              {item.price.toLocaleString()}
              {item.currency !== 'USD' && ` ${item.currency}`}
            </p>
          )}

          {item.item_type && (
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {item.item_type}
            </p>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={onAddAnother}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Add Another Item
        </button>
      </div>
    </main>
  )
}

// Error View Component
function ErrorView({
  error,
  onRetry,
  onReset
}: {
  error: string
  onRetry?: () => void
  onReset: () => void
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold mb-2">Could not add item</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>

        <div className="space-y-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Retry
            </button>
          )}

          <button
            onClick={onReset}
            className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Try Different URL
          </button>
        </div>
      </div>
    </main>
  )
}
