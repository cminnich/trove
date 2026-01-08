'use client'

import { useEffect, useRef } from 'react'
import type { CaptureContext } from '@/types/capture'

interface ContextFormProps {
  value: CaptureContext
  onChange: (context: CaptureContext) => void
  disabled?: boolean
}

/**
 * Auto-focused textarea for user context (notes)
 * Maps to collection_items.notes field
 */
export function ContextForm({ value, onChange, disabled = false }: ContextFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus()
    }
  }, [disabled])

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value.notes])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...value,
      notes: e.target.value,
      isDirty: true
    })
  }

  return (
    <div className="w-full">
      <label
        htmlFor="context-notes"
        className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
      >
        Add Your Context
      </label>
      <textarea
        ref={textareaRef}
        id="context-notes"
        value={value.notes}
        onChange={handleChange}
        disabled={disabled}
        placeholder="e.g., Research for the kitchen remodel, a birthday gift idea for Shannon, or just 'want this'..."
        rows={3}
        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Why are you saving this? Add notes to give AI better context.
      </p>
    </div>
  )
}
