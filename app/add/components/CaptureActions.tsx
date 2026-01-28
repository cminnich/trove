import type { SaveIntent } from '@/types/capture'

interface CaptureActionsProps {
  canSave: boolean
  isSaving: boolean
  extractionComplete: boolean
  saveIntent: SaveIntent
  isExisting?: boolean
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
  isExisting = false,
  onSave,
  onCancel
}: CaptureActionsProps) {
  // Determine save button label
  const getSaveLabel = (): string => {
    if (saveIntent.type === 'pending') return 'Finalizing...'
    if (isSaving) return isExisting ? 'Updating...' : 'Saving...'
    return isExisting ? 'Update in Trove' : 'Save to Trove'
  }

  // Determine if save button should be disabled
  const isSaveDisabled = !canSave || isSaving || saveIntent.type === 'pending'

  return (
    <div className="w-full space-y-3">
      {/* Status indicator */}
      {extractionComplete && saveIntent.type === 'ready' && (
        <div className="p-3 bg-open-green/10 border border-open-green/30 rounded-lg">
          <p className="text-sm text-open-green font-mono flex items-center gap-2">
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
        className="w-full bg-open-green hover:bg-emerald-400 text-void font-mono font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-open-green"
      >
        {getSaveLabel()}
      </button>

      {/* Cancel button */}
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving || saveIntent.type === 'pending'}
        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-medium py-3 px-4 rounded-lg transition-colors border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>

      {/* Helper text */}
      {!canSave && !isSaving && (
        <p className="text-xs text-slate-500 font-mono text-center">
          // Add context or select a collection to save
        </p>
      )}
    </div>
  )
}
