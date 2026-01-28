import { useMockProgress } from '../hooks/useMockProgress'
import type { ExtractionState } from '@/types/capture'

interface MockProgressBarProps {
  extractionState: ExtractionState
  onComplete?: () => void
}

/**
 * Mock progress bar with hardcoded timing:
 * - 0 → 80% over 5 seconds (steady)
 * - 80% freeze after 10 seconds (exponential slowdown)
 * - Jump to 100% when extraction completes
 *
 * Visual states: active (blue), stalled (amber), complete (green), error (red)
 */
export function MockProgressBar({ extractionState, onComplete }: MockProgressBarProps) {
  const { progress, isStalled } = useMockProgress({
    extractionComplete: extractionState.status === 'complete',
    onComplete
  })

  // Determine visual state
  const getProgressColor = (): string => {
    if (extractionState.status === 'failed') return 'bg-red-500'
    if (extractionState.status === 'complete') return 'bg-open-green'
    if (isStalled) return 'bg-amber-500'
    return 'bg-open-green'
  }

  const getStatusText = (): string => {
    if (extractionState.status === 'failed') {
      return extractionState.error
    }
    if (extractionState.status === 'complete') {
      return 'Item extracted successfully'
    }
    if (isStalled) {
      return 'Still working...'
    }
    return '// Librarian is cataloging details...'
  }

  const getContainerColor = (): string => {
    if (extractionState.status === 'failed') return 'border-red-800 bg-red-900/20'
    if (extractionState.status === 'complete') return 'border-open-green/30 bg-open-green/10'
    if (isStalled) return 'border-amber-800 bg-amber-900/20'
    return 'border-slate-800 bg-slate-deep'
  }

  return (
    <div className={`w-full p-4 rounded-lg border ${getContainerColor()} transition-colors duration-300`}>
      {/* Status text */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-mono font-medium text-slate-300">
          {getStatusText()}
        </p>
        <span className="text-xs font-mono text-slate-500">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${getProgressColor()} transition-all duration-200 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stalled indicator */}
      {isStalled && extractionState.status === 'in_progress' && (
        <p className="text-xs text-amber-400 font-mono mt-2">
          This is taking longer than expected...
        </p>
      )}
    </div>
  )
}
