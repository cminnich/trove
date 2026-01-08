import type { SaveIntent } from '@/types/capture'

interface CaptureActionsProps {
  canSave: boolean
  isSaving: boolean
  extractionComplete: boolean
  saveIntent: SaveIntent
  onSave: () => void
  onCancel: () => void
}

/**
 * Save and Cancel buttons with state-aware labels
 * Shows "Save", "Saving...", or "Finalizing..." based on state
 */
export function CaptureActions({
  canSave,
  isSaving,
  extractionComplete,
  saveIntent,
  onSave,
  onCancel
}: CaptureActionsProps) {
  // Determine save button label
  const getSaveLabel = (): string => {
    if (saveIntent.type === 'pending') return 'Finalizing...'
    if (isSaving) return 'Saving...'
    return 'Save to Trove'
  }

  // Determine if save button should be disabled
  const isSaveDisabled = !canSave || isSaving || saveIntent.type === 'pending'

  return (
    <div className="w-full space-y-3">
      {/* Status indicator */}
      {extractionComplete && saveIntent.type === 'ready' && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
            <span className="text-base">✓</span>
            <span>Item extracted - ready to save</span>
          </p>
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={onSave}
        disabled={isSaveDisabled}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
      >
        {getSaveLabel()}
      </button>

      {/* Cancel button */}
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving || saveIntent.type === 'pending'}
        className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>

      {/* Helper text */}
      {!canSave && !isSaving && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Add context or select a collection to save
        </p>
      )}
    </div>
  )
}
