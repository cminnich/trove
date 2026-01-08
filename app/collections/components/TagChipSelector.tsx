'use client'

import { useState, useEffect } from 'react'

interface TagChipSelectorProps {
  value: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
}

/**
 * Multi-select chip selector for item tags
 * Shows active tags (on item) and available tags (from user's other items)
 */
export function TagChipSelector({
  value,
  onChange,
  disabled = false
}: TagChipSelectorProps) {
  const [allTags, setAllTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewInput, setShowNewInput] = useState(false)
  const [newTag, setNewTag] = useState('')

  // Fetch user's existing tags
  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await fetch('/api/tags')
        const data = await response.json()
        if (data.success) {
          setAllTags(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTags()
  }, [])

  const addTag = (tag: string) => {
    if (disabled) return
    const trimmedTag = tag.trim()
    if (trimmedTag && !value.includes(trimmedTag)) {
      onChange([...value, trimmedTag])
      // Add to local list if not already there
      if (!allTags.includes(trimmedTag)) {
        setAllTags([...allTags, trimmedTag].sort())
      }
    }
  }

  const removeTag = (tagToRemove: string) => {
    if (disabled) return
    onChange(value.filter(tag => tag !== tagToRemove))
  }

  const handleCreateNew = () => {
    if (newTag.trim()) {
      addTag(newTag.trim())
      setNewTag('')
      setShowNewInput(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCreateNew()
    } else if (e.key === 'Escape') {
      setNewTag('')
      setShowNewInput(false)
    }
  }

  // Tags not currently on this item
  const availableTags = allTags.filter(tag => !value.includes(tag))

  if (loading) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Tags
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Tags
      </label>

      {/* Active tags section - shown when there are tags on the item */}
      {value.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Tags on this item:
          </p>
          <div className="flex flex-wrap gap-2">
            {value.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="group flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-indigo-600 text-white border-2 border-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {tag}
                <span className="text-white group-hover:text-indigo-200">×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Available tags and add new section - always shown */}
      <div>
        {availableTags.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Your tags (tap to add):
          </p>
        )}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {availableTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              disabled={disabled}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {tag}
            </button>
          ))}

          {/* New tag input or button - always available */}
          {showNewInput ? (
            <div className="flex-shrink-0 flex gap-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!newTag.trim()) {
                    setShowNewInput(false)
                  }
                }}
                placeholder="New tag"
                autoFocus
                className="w-32 px-3 py-2 text-sm rounded-full border-2 border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-indigo-600"
              />
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={!newTag.trim()}
                className="px-3 py-2 rounded-full text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                ✓
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewInput(true)}
              disabled={disabled}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + New
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
