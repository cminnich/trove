'use client'

import { useRouter } from 'next/navigation'
import type { Database } from '@/types/database'
import type { CaptureContext, DeepExtractionState } from '@/types/capture'

type Item = Database['public']['Tables']['items']['Row']
type Collection = Database['public']['Tables']['collections']['Row']

interface ProcessingCardProps {
  item: Item
  url: string
  context: CaptureContext
  collections: Collection[]
  deepExtraction: DeepExtractionState
}

/**
 * Processing card shown after save while deep extraction runs.
 * Features:
 * - AI shimmer effect on card background
 * - Abbreviated URL (no https/www)
 * - Manual context displayed prominently
 * - Collection chips that link to collection pages
 */
export function ProcessingCard({
  item,
  url,
  context,
  collections,
  deepExtraction
}: ProcessingCardProps) {
  const router = useRouter()

  // Format URL: strip https:// and www.
  const formatUrl = (fullUrl: string): string => {
    try {
      const urlObj = new URL(fullUrl)
      const host = urlObj.hostname.replace(/^www\./, '')
      const path = urlObj.pathname + urlObj.search
      return host + (path === '/' ? '' : path)
    } catch {
      return fullUrl
    }
  }

  // Check if deep extraction is still running
  const isProcessing = deepExtraction.status === 'pending' || deepExtraction.status === 'in_progress'

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-pink-50/80 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-pink-950/30 backdrop-blur-sm rounded-2xl border border-indigo-200/50 dark:border-indigo-800/50">
      {/* AI Shimmer animation - only visible when processing */}
      {isProcessing && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent" />
      )}

      {/* Subtle pulsing border when processing */}
      {isProcessing && (
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-20 blur-sm animate-pulse" />
      )}

      <div className="relative p-6">
        {/* Processing status */}
        <div className="flex items-center gap-2 mb-4">
          {isProcessing ? (
            <>
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                Enhancing with AI...
              </span>
            </>
          ) : deepExtraction.status === 'complete' ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                Enhanced
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Basic extraction
              </span>
            </>
          )}
        </div>

        {/* Item image (if available) */}
        {item.image_url && (
          <div className="w-full h-40 mb-4 rounded-lg overflow-hidden bg-white/50 dark:bg-gray-800/50">
            <img
              src={item.image_url}
              alt={item.title || 'Item image'}
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Title (if extracted) */}
        {item.title && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {item.title}
          </h3>
        )}

        {/* Brand */}
        {item.brand && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {item.brand}
          </p>
        )}

        {/* Price */}
        {item.price && item.currency && (
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 font-mono mb-3">
            {item.currency === 'USD' && '$'}
            {item.price.toLocaleString()}
            {item.currency !== 'USD' && ` ${item.currency}`}
          </p>
        )}

        {/* Manual context - displayed prominently if no title */}
        {context.notes && (
          <div className={`${!item.title ? 'mb-4' : 'mb-3'}`}>
            {!item.title && (
              <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed">
                {context.notes}
              </p>
            )}
            {item.title && (
              <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Your notes
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {context.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Abbreviated URL */}
        <div className="mb-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {formatUrl(url)}
          </a>
        </div>

        {/* Collection chips */}
        {collections.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-1 self-center">
              Filed in:
            </span>
            {collections.map(collection => (
              <button
                key={collection.id}
                onClick={() => router.push(`/collections/${collection.id}`)}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {collection.type === 'inbox' && (
                  <span className="mr-1">📥</span>
                )}
                {collection.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
