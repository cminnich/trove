'use client'

import { useState, useMemo } from 'react'
import type { Database } from '@/types/database'
import type { CaptureContext } from '@/types/capture'
import { CreateCollectionSheet } from '@/app/collections/components/CreateCollectionSheet'

type Collection = Database['public']['Tables']['collections']['Row']

interface CollectionSelectorProps {
  collections: Collection[]
  value: CaptureContext
  onChange: (context: CaptureContext) => void
  disabled?: boolean
  loading?: boolean
  onCollectionsChange?: () => void
}

/**
 * Horizontal scrollable chip list for multi-select collections
 * Smart Inbox fallback: Inbox shows as "visual fallback" when no collections selected,
 * auto-deselects when other collections are chosen, explicit click activates it fully.
 */
export function CollectionSelector({
  collections,
  value,
  onChange,
  disabled = false,
  loading = false,
  onCollectionsChange
}: CollectionSelectorProps) {
  const [createSheetOpen, setCreateSheetOpen] = useState(false)

  // Find inbox collection
  const inboxCollection = useMemo(
    () => collections.find(c => c.type === 'inbox'),
    [collections]
  )

  // Get non-inbox selected collections
  const nonInboxSelections = useMemo(
    () => value.selectedCollections.filter(id => id !== inboxCollection?.id),
    [value.selectedCollections, inboxCollection?.id]
  )

  // Determine if inbox is in "fallback" mode (no explicit selection, no other collections)
  const isInboxFallback = useMemo(() => {
    if (!inboxCollection) return false
    // Fallback mode: no selections at all, OR only inbox selected but not explicitly
    const hasNoSelections = value.selectedCollections.length === 0
    const onlyInboxSelected = value.selectedCollections.length === 1 &&
      value.selectedCollections[0] === inboxCollection.id &&
      !value.inboxExplicitlySelected
    return hasNoSelections || onlyInboxSelected
  }, [value.selectedCollections, value.inboxExplicitlySelected, inboxCollection])

  // Check if inbox is actively selected (explicitly or as fallback)
  const isInboxActive = useMemo(() => {
    if (!inboxCollection) return false
    return isInboxFallback || value.selectedCollections.includes(inboxCollection.id)
  }, [isInboxFallback, value.selectedCollections, inboxCollection])

  const toggleCollection = (collectionId: string) => {
    if (disabled) return

    const isInbox = collectionId === inboxCollection?.id
    const isSelected = value.selectedCollections.includes(collectionId)

    if (isInbox) {
      // Inbox click behavior
      if (isInboxFallback) {
        // User explicitly activating inbox from fallback state
        onChange({
          ...value,
          selectedCollections: [collectionId],
          inboxExplicitlySelected: true,
          isDirty: true
        })
      } else if (isSelected) {
        // Deselecting inbox
        onChange({
          ...value,
          selectedCollections: value.selectedCollections.filter(id => id !== collectionId),
          inboxExplicitlySelected: false,
          isDirty: true
        })
      } else {
        // Selecting inbox explicitly
        onChange({
          ...value,
          selectedCollections: [...value.selectedCollections, collectionId],
          inboxExplicitlySelected: true,
          isDirty: true
        })
      }
    } else {
      // Non-inbox collection click
      if (isSelected) {
        // Deselecting a non-inbox collection
        const newSelections = value.selectedCollections.filter(id => id !== collectionId)
        // If no collections left, inbox reverts to fallback (remove it from selections)
        const shouldRevertInbox = newSelections.length === 0 ||
          (newSelections.length === 1 && newSelections[0] === inboxCollection?.id && !value.inboxExplicitlySelected)

        onChange({
          ...value,
          selectedCollections: shouldRevertInbox
            ? newSelections.filter(id => id !== inboxCollection?.id)
            : newSelections,
          inboxExplicitlySelected: shouldRevertInbox ? false : value.inboxExplicitlySelected,
          isDirty: true
        })
      } else {
        // Selecting a non-inbox collection
        // Auto-remove inbox if it was only in fallback mode (not explicitly selected)
        const newSelections = value.inboxExplicitlySelected
          ? [...value.selectedCollections, collectionId]
          : [...value.selectedCollections.filter(id => id !== inboxCollection?.id), collectionId]

        onChange({
          ...value,
          selectedCollections: newSelections,
          isDirty: true
        })
      }
    }
  }

  const handleCreateCollection = (collection?: { id: string; name: string }) => {
    // Refresh collections list
    onCollectionsChange?.()

    // Auto-select the newly created collection if provided
    if (collection) {
      // Remove inbox from fallback when adding to a new collection
      const newSelections = value.inboxExplicitlySelected
        ? [...value.selectedCollections, collection.id]
        : [...value.selectedCollections.filter(id => id !== inboxCollection?.id), collection.id]

      onChange({
        ...value,
        selectedCollections: newSelections,
        isDirty: true
      })
    }
  }

  const isSelected = (collectionId: string) => value.selectedCollections.includes(collectionId)

  if (loading) {
    return (
      <div className="w-full">
        <label className="block text-sm font-mono font-medium mb-2 text-slate-300">
          File Under
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-9 w-24 bg-slate-800 rounded-full animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  // Get chip styling based on collection type and selection state
  const getChipStyle = (collection: Collection) => {
    const isInbox = collection.type === 'inbox'
    const selected = isSelected(collection.id)

    // Inbox in fallback mode: dashed border, ghost background
    if (isInbox && isInboxFallback) {
      return 'bg-open-green/10 text-open-green border-2 border-dashed border-open-green/40 hover:border-open-green/60'
    }

    // Selected (explicit inbox or any other collection)
    if (selected || (isInbox && isInboxActive && !isInboxFallback)) {
      return 'bg-open-green text-void border-2 border-open-green'
    }

    // Unselected
    return 'bg-slate-800 text-slate-300 border-2 border-slate-700 hover:border-open-green'
  }

  // Get inbox icon based on state
  const getInboxIcon = (collection: Collection) => {
    if (collection.type !== 'inbox') return null

    // Fallback mode: sparkle icon to indicate "magic" default
    if (isInboxFallback) {
      return (
        <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
          <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
        </svg>
      )
    }

    // Explicitly selected: inbox icon
    return <span className="mr-1">📥</span>
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-mono font-medium mb-2 text-slate-300">
        File Under
      </label>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {collections.map(collection => (
          <button
            key={collection.id}
            type="button"
            onClick={() => toggleCollection(collection.id)}
            disabled={disabled}
            className={`
              flex-shrink-0 px-4 py-2 rounded-full text-sm font-mono font-medium transition-all
              flex items-center
              ${getChipStyle(collection)}
              disabled:opacity-50 disabled:cursor-not-allowed
              active:scale-95
            `}
          >
            {getInboxIcon(collection)}
            {collection.name}
            {(collection as { access_type?: string }).access_type === "editor" && (
              <span className="ml-1.5 text-xs opacity-80">(Shared)</span>
            )}
          </button>
        ))}

        {/* Create New Collection Button */}
        <button
          type="button"
          onClick={() => setCreateSheetOpen(true)}
          disabled={disabled}
          className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-mono font-medium bg-slate-800 text-slate-400 border-2 border-dashed border-slate-700 hover:border-open-green hover:text-open-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + New
        </button>
      </div>

      {/* Fallback hint - only show when inbox is in fallback mode */}
      {isInboxFallback && (
        <p className="text-xs text-open-green font-mono mt-1 flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
          </svg>
          Auto-filing to Inbox (select a collection to change)
        </p>
      )}

      {/* Create Collection Sheet */}
      <CreateCollectionSheet
        open={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        onSuccess={handleCreateCollection}
      />
    </div>
  )
}
