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
    if (extractionState.status === 'complete') return 'bg-green-500'
    if (isStalled) return 'bg-amber-500'
    return 'bg-indigo-600'
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
    return 'Librarian is cataloging details...'
  }

  const getContainerColor = (): string => {
    if (extractionState.status === 'failed') return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    if (extractionState.status === 'complete') return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
    if (isStalled) return 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
    return 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20'
  }

  return (
    <div className={`w-full p-4 rounded-lg border ${getContainerColor()} transition-colors duration-300`}>
      {/* Status text */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {getStatusText()}
        </p>
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${getProgressColor()} transition-all duration-200 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stalled indicator */}
      {isStalled && extractionState.status === 'in_progress' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          This is taking longer than expected...
        </p>
      )}
    </div>
  )
}
