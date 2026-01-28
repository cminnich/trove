'use client'

import { useState } from 'react'
import type { Database } from '@/types/database'
import { ConfidenceBadge } from '@/app/components/ConfidenceBadge'
import { getItemDisplayTitle, formatUrlForDisplay } from '@/lib/url-formatter'
import { RefreshCw, AlertCircle } from 'lucide-react'

type Item = Database['public']['Tables']['items']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface ItemCardProps {
  item: ItemWithCollectionMetadata
  variant?: 'grid' | 'list' | 'spec-sheet'
  onClick?: () => void
  onUpdate?: () => void
}

export function ItemCard({ item, variant = 'grid', onClick, onUpdate }: ItemCardProps) {
  const [retrying, setRetrying] = useState(false)
  const needsReview = item.confidence_score !== null && item.confidence_score < 0.7
  
  // Check if extraction needs retry
  const isStuck = item.extraction_status === 'processing' &&
    item.extraction_started_at &&
    new Date().getTime() - new Date(item.extraction_started_at).getTime() > 60000
  const needsRetry = item.extraction_status === 'failed' || isStuck
  
  const displayTitle = getItemDisplayTitle(item.title, item.source_url)
  const formattedUrl = formatUrlForDisplay(item.source_url, 30)
  
  // Get display type - use formatted URL instead of "article"
  const displayType = item.item_type === 'article' && !item.title 
    ? formattedUrl || 'article'
    : item.item_type

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    setRetrying(true)
    try {
      const response = await fetch(`/api/items/${item.id}/re-extract`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        onUpdate?.()
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

  if (variant === 'list') {
    return (
      <div className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div
            className="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center cursor-pointer"
            onClick={onClick}
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={displayTitle}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="text-2xl text-gray-300 dark:text-gray-600">📦</div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0" onClick={onClick}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate flex-1 cursor-pointer">
                {displayTitle}
              </h3>
              {needsRetry && (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="flex-shrink-0 p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                  title={item.extraction_status === 'failed' ? 'Retry extraction' : 'Retry stuck extraction'}
                >
                  {retrying ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : item.extraction_status === 'failed' ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
            {item.brand && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{item.brand}</p>
            )}
            {item.price && item.currency && (
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                {item.currency === 'USD' && '$'}
                {item.price.toLocaleString()}
                {item.currency !== 'USD' && ` ${item.currency}`}
              </p>
            )}
            <div className="flex gap-2 mt-2 flex-wrap">
              {item.category && (
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  {item.category}
                </span>
              )}
              {displayType && (
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded capitalize">
                  {displayType}
                </span>
              )}
              {needsReview && (
                <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded">
                  ⚠️ Review
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Spec-sheet variant - Terminal Noir style with metadata table
  if (variant === 'spec-sheet') {
    // Extract key attributes from item.attributes for display
    const attributes = item.attributes as Record<string, unknown> || {}
    const attributeEntries = Object.entries(attributes).filter(
      ([key, value]) => value !== null && value !== undefined && value !== ''
    ).slice(0, 4) // Show max 4 custom attributes

    return (
      <div
        className="w-full bg-void border border-slate-800 rounded-md shadow-hard overflow-hidden cursor-pointer hover:border-slate-700 transition-colors"
        onClick={onClick}
      >
        {/* Image */}
        <div className="w-full aspect-square bg-slate-deep overflow-hidden flex items-center justify-center">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={displayTitle}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="text-6xl text-slate-700">📦</div>
          )}
        </div>

        {/* Title */}
        <div className="border-t border-slate-800 px-3 py-2">
          <h3 className="font-mono font-bold text-white text-sm line-clamp-2 uppercase tracking-wide">
            {displayTitle}
          </h3>
          {needsReview && (
            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded font-mono">
              REVIEW
            </span>
          )}
        </div>

        {/* Spec Table */}
        <div className="border-t border-slate-800">
          <table className="w-full font-mono text-xs">
            <tbody>
              {item.brand && (
                <tr className="border-b border-slate-800/50">
                  <td className="px-3 py-1.5 text-slate-500 w-1/3">Brand</td>
                  <td className="px-3 py-1.5 text-slate-300 text-right">{item.brand}</td>
                </tr>
              )}
              {item.price && item.currency && (
                <tr className="border-b border-slate-800/50">
                  <td className="px-3 py-1.5 text-slate-500 w-1/3">Price</td>
                  <td className="px-3 py-1.5 text-open-green font-bold text-right">
                    {item.currency === 'USD' && '$'}
                    {item.price.toLocaleString()}
                    {item.currency !== 'USD' && ` ${item.currency}`}
                  </td>
                </tr>
              )}
              {item.category && (
                <tr className="border-b border-slate-800/50">
                  <td className="px-3 py-1.5 text-slate-500 w-1/3">Category</td>
                  <td className="px-3 py-1.5 text-slate-300 text-right">{item.category}</td>
                </tr>
              )}
              {/* Custom attributes from item.attributes */}
              {attributeEntries.map(([key, value]) => (
                <tr key={key} className="border-b border-slate-800/50 last:border-b-0">
                  <td className="px-3 py-1.5 text-slate-500 w-1/3 capitalize">
                    {key.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-1.5 text-slate-300 text-right truncate max-w-[150px]">
                    {String(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Grid variant
  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors p-4 relative">
      {/* Retry Button - Top Right */}
      {needsRetry && (
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-sm text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 z-10"
          title={item.extraction_status === 'failed' ? 'Retry extraction' : 'Retry stuck extraction'}
        >
          {retrying ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : item.extraction_status === 'failed' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      )}

      <button
        onClick={onClick}
        className="w-full text-left"
      >
        {/* Confidence Badge */}
        {needsReview && (
          <div className="mb-3">
            <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded">
              ⚠️ Review
            </span>
          </div>
        )}

        {/* Image */}
        <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center mb-3">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={displayTitle}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="text-6xl text-gray-300 dark:text-gray-600">📦</div>
          )}
        </div>

        {/* Details */}
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
          {displayTitle}
        </h3>

        {item.brand && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{item.brand}</p>
        )}

        {item.price && item.currency && (
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 font-mono mb-2">
            {item.currency === 'USD' && '$'}
            {item.price.toLocaleString()}
            {item.currency !== 'USD' && ` ${item.currency}`}
          </p>
        )}

        {displayType && (
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {displayType}
          </p>
        )}
      </button>
    </div>
  )
}
