'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Settings2, Check, Eye, EyeOff, RotateCcw } from 'lucide-react'
import type { Database } from '@/types/database'

type ItemAttribute = Database['public']['Tables']['item_attributes']['Row']
type FilterPreference = Database['public']['Tables']['collection_filter_preferences']['Row']
type GlobalAttributeSchema = Database['public']['Tables']['attribute_schemas']['Row']

// Unified schema interface that works for both global and collection schemas
// This matches the API response format
interface UnifiedSchema {
  id: string
  name: string
  display_name: string
  description: string | null
  display_order: number
  is_collection_schema: boolean
  is_visible?: boolean
}

interface AttributeWithSchema extends ItemAttribute {
  schema: UnifiedSchema
}

interface AttributeWithCount {
  attribute: AttributeWithSchema
  related_count: number
}

interface FilterPreferenceWithSchema extends FilterPreference {
  schema: GlobalAttributeSchema
}

interface ConnectionChipsProps {
  attributes: AttributeWithCount[]
  activeFilter: string | null
  onFilterSelect: (groupKey: string) => void
  onFilterClear: () => void
  isLoading?: boolean
  totalCollectionItems?: number
  filterPreferences?: FilterPreferenceWithSchema[]
  onToggleFilter?: (schemaId: string, isHidden: boolean, forceShow: boolean) => void
  onResetFilter?: (schemaId: string) => void
  onToggleCollectionSchema?: (schemaId: string, isVisible: boolean) => void
}

export function ConnectionChips({
  attributes,
  activeFilter,
  onFilterSelect,
  onFilterClear,
  isLoading,
  totalCollectionItems,
  filterPreferences = [],
  onToggleFilter,
  onResetFilter,
  onToggleCollectionSchema,
}: ConnectionChipsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false)
      }
    }

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSettingsOpen])

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse flex-shrink-0"
          />
        ))}
      </div>
    )
  }

  // Build preferences lookup map
  const prefsMap = new Map<string, FilterPreferenceWithSchema>()
  for (const pref of filterPreferences) {
    prefsMap.set(pref.schema_id, pref)
  }

  // Determine which attributes to show based on auto-hide logic and preferences
  const visibleAttributes: AttributeWithCount[] = []
  const hiddenAttributes: AttributeWithCount[] = []

  for (const attr of attributes) {
    // Skip if no related items (this shouldn't happen but safeguard)
    if (attr.related_count === 0) continue

    const isCollectionSchema = attr.attribute.schema.is_collection_schema
    const pref = prefsMap.get(attr.attribute.schema.id)
    const isAllItemsMatch = totalCollectionItems && attr.related_count === totalCollectionItems

    // Determine visibility based on schema type
    let isVisible = true
    let isAutoHidden = false

    if (isCollectionSchema) {
      // For collection schemas, use the is_visible flag directly
      isVisible = attr.attribute.schema.is_visible !== false
      // Collection schemas don't use auto-hide logic from preferences
      if (!isVisible) {
        isAutoHidden = false
      }
    } else {
      // For global schemas, use the filter preferences system
      // 1. If force_show is true, always show
      // 2. If is_hidden is true, always hide
      // 3. Otherwise, auto-hide if all items match
      if (pref?.force_show) {
        isVisible = true
      } else if (pref?.is_hidden) {
        isVisible = false
      } else if (isAllItemsMatch) {
        isVisible = false
        isAutoHidden = true
      }
    }

    if (isVisible) {
      visibleAttributes.push(attr)
    } else {
      // Store with auto-hidden flag for settings display
      hiddenAttributes.push(attr)
    }
  }

  // All available attribute types (for settings)
  const allAttributeTypes = attributes.filter((a) => a.related_count > 0)

  if (visibleAttributes.length === 0 && allAttributeTypes.length === 0) {
    return null
  }

  return (
    <div className="relative">
      {/* Active filter indicator */}
      {activeFilter && (
        <button
          onClick={onFilterClear}
          className="absolute -top-2 -right-2 z-10 p-1 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
          aria-label="Clear filter"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <div className="flex items-center gap-2">
        {/* Chips container */}
        <div className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {visibleAttributes.map((attr) => {
            const isActive = activeFilter === attr.attribute.group_key
            const displayName = getDisplayName(attr.attribute)

            return (
              <button
                key={attr.attribute.id}
                onClick={() => {
                  if (isActive) {
                    onFilterClear()
                  } else {
                    onFilterSelect(attr.attribute.group_key)
                  }
                }}
                className={`
                  flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium
                  transition-all duration-200 flex items-center gap-1.5
                  ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md scale-105'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <span className="capitalize">{displayName}</span>
                <span
                  className={`
                    text-xs px-1.5 py-0.5 rounded-full
                    ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                    }
                  `}
                >
                  {attr.related_count}
                </span>
              </button>
            )
          })}

          {/* Show placeholder if all chips are hidden */}
          {visibleAttributes.length === 0 && allAttributeTypes.length > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400 italic py-1.5">
              All filters hidden
            </span>
          )}
        </div>

        {/* Settings button - only show if there's at least one attribute */}
        {allAttributeTypes.length > 0 && onToggleFilter && (
          <div className="relative flex-shrink-0">
            <button
              ref={buttonRef}
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`
                p-2 rounded-lg transition-colors
                ${
                  isSettingsOpen
                    ? 'bg-gray-200 dark:bg-gray-700'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
              aria-label="Filter settings"
              aria-expanded={isSettingsOpen}
            >
              <Settings2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>

            {/* Settings popover */}
            {isSettingsOpen && (
              <div
                ref={settingsRef}
                className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
              >
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Filter Visibility
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Choose which filters to show. Filters shared by all items are auto-hidden.
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {allAttributeTypes.map((attr) => {
                    const isCollectionSchema = attr.attribute.schema.is_collection_schema
                    const pref = prefsMap.get(attr.attribute.schema.id)
                    const isAllItemsMatch =
                      totalCollectionItems && attr.related_count === totalCollectionItems

                    // Calculate visibility based on schema type
                    let isVisible: boolean
                    let isAutoHidden = false

                    if (isCollectionSchema) {
                      isVisible = attr.attribute.schema.is_visible !== false
                    } else {
                      isAutoHidden = !pref?.force_show && !pref?.is_hidden && !!isAllItemsMatch
                      const isManuallyHidden = pref?.is_hidden
                      const isForceShown = pref?.force_show
                      isVisible = !isManuallyHidden && (isForceShown || !isAllItemsMatch)
                    }

                    return (
                      <div
                        key={attr.attribute.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900 dark:text-gray-100 capitalize truncate">
                              {attr.attribute.schema?.display_name || attr.attribute.schema?.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                              ({attr.related_count})
                            </span>
                            {isCollectionSchema && (
                              <span className="text-xs text-indigo-500 dark:text-indigo-400">
                                AI
                              </span>
                            )}
                          </div>
                          {isAutoHidden && !isCollectionSchema && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              Auto-hidden (all items)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {/* Show/hide toggle */}
                          <button
                            onClick={() => {
                              if (isCollectionSchema && onToggleCollectionSchema) {
                                // For collection schemas, toggle is_visible directly
                                onToggleCollectionSchema(attr.attribute.schema.id, !isVisible)
                              } else if (onToggleFilter) {
                                // For global schemas, use filter preferences
                                if (isVisible) {
                                  onToggleFilter(attr.attribute.schema.id, true, false)
                                } else {
                                  onToggleFilter(
                                    attr.attribute.schema.id,
                                    false,
                                    isAutoHidden || false
                                  )
                                }
                              }
                            }}
                            className={`
                              p-1.5 rounded transition-colors
                              ${
                                isVisible
                                  ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                                  : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }
                            `}
                            title={isVisible ? 'Hide filter' : 'Show filter'}
                          >
                            {isVisible ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>

                          {/* Reset button (only show for global schemas with a preference) */}
                          {!isCollectionSchema && pref && onResetFilter && (
                            <button
                              onClick={() => onResetFilter(attr.attribute.schema.id)}
                              className="p-1.5 rounded text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Reset to auto-hide"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function getDisplayName(attribute: AttributeWithSchema): string {
  const schemaName = attribute.schema?.name
  const rawValue = attribute.raw_value

  // For price range, use the raw value directly
  if (schemaName === 'price_range') {
    // Convert price range key to display format
    const priceRangeMap: Record<string, string> = {
      'under-50': 'Under $50',
      '50-100': '$50-100',
      '100-250': '$100-250',
      '250-500': '$250-500',
      '500-1000': '$500-1K',
      '1000-5000': '$1K-5K',
      '5000-plus': '$5K+',
    }
    return priceRangeMap[attribute.normalized_value] || rawValue
  }

  // For other attributes, title case the raw value
  return rawValue
}
