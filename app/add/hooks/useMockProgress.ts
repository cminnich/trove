import { useState, useEffect, useRef } from 'react'

interface MockProgressOptions {
  onComplete?: () => void
  extractionComplete?: boolean
}

interface MockProgressReturn {
  progress: number
  isStalled: boolean
}

/**
 * Mock progress bar timing algorithm:
 * - 0 → 80% over 5 seconds (steady increase)
 * - 80% freeze after 10 seconds (exponential slowdown)
 * - Jump to 100% when extraction actually completes
 *
 * Provides perceived performance during background extraction.
 */
export function useMockProgress({
  onComplete,
  extractionComplete = false
}: MockProgressOptions): MockProgressReturn {
  const [progress, setProgress] = useState(0)
  const [isStalled, setIsStalled] = useState(false)
  const startTimeRef = useRef<number>(Date.now())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Reset on mount
    startTimeRef.current = Date.now()
    setProgress(0)
    setIsStalled(false)

    // If extraction is already complete, jump to 100%
    if (extractionComplete) {
      setProgress(100)
      onComplete?.()
      return
    }

    // Update progress every 100ms
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current

      // Phase 1: 0 → 80% over 5 seconds (steady increase)
      if (elapsed < 5000) {
        const newProgress = (elapsed / 5000) * 80
        setProgress(Math.min(newProgress, 80))
        return
      }

      // Phase 2: 80% → 80% with exponential slowdown (simulate stalling)
      if (elapsed < 10000) {
        // Very slow progress from 80% to 82% over next 5 seconds
        const phase2Elapsed = elapsed - 5000
        const increment = (phase2Elapsed / 5000) * 2
        setProgress(Math.min(80 + increment, 82))
        setIsStalled(true)
        return
      }

      // Phase 3: Freeze at 80-82% after 10 seconds
      setProgress(82)
      setIsStalled(true)
    }, 100)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // When extraction completes, jump to 100%
  useEffect(() => {
    if (extractionComplete && progress < 100) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      setProgress(100)
      setIsStalled(false)
      onComplete?.()
    }
  }, [extractionComplete, progress, onComplete])

  return { progress, isStalled }
}
