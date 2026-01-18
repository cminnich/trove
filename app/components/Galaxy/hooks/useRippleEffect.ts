import { useCallback, useRef, useState } from 'react'
import { type Vec2 } from '@/types/meditative-capture'
import { useHaptics, GalaxyHaptics } from './useHaptics'

/**
 * Ripple Effect Configuration
 */
export interface RippleConfig {
  /** Duration of the ripple animation in ms */
  duration: number
  /** Maximum scale of the ripple */
  maxScale: number
  /** Number of ripple rings */
  ringCount: number
  /** Delay between rings */
  ringDelay: number
  /** Color of the ripple */
  color: string
}

const DEFAULT_CONFIG: RippleConfig = {
  duration: 800,
  maxScale: 3,
  ringCount: 3,
  ringDelay: 100,
  color: 'rgba(139, 92, 246, 0.4)', // Purple
}

/**
 * Individual ring state
 */
export interface RippleRing {
  id: number
  scale: number
  opacity: number
  startTime: number
}

/**
 * Ripple effect state
 */
export interface RippleState {
  isActive: boolean
  position: Vec2
  rings: RippleRing[]
  progress: number // 0-1 for the whole animation
}

const INITIAL_STATE: RippleState = {
  isActive: false,
  position: { x: 0, y: 0 },
  rings: [],
  progress: 0,
}

interface UseRippleEffectReturn {
  /** Current ripple state */
  state: RippleState
  /** Start a ripple at position */
  startRipple: (position: Vec2) => void
  /** Stop the ripple */
  stopRipple: () => void
  /** Start a long-press ripple (with threshold callback) */
  startLongPressRipple: (
    position: Vec2,
    threshold: number,
    onThresholdReached: () => void
  ) => void
}

/**
 * Hook for creating ripple effects
 *
 * Used for:
 * - Long-press feedback during nebula creation
 * - The Snap pulse ring
 * - Touch feedback on interactions
 *
 * Usage:
 * ```tsx
 * const { state, startRipple, startLongPressRipple } = useRippleEffect()
 *
 * // Simple ripple
 * startRipple({ x: 100, y: 100 })
 *
 * // Long-press with threshold
 * startLongPressRipple(position, 1000, () => {
 *   // Threshold reached - create nebula
 * })
 *
 * // Render ripples
 * {state.rings.map(ring => (
 *   <div
 *     key={ring.id}
 *     style={{
 *       transform: `translate(${state.position.x}px, ${state.position.y}px) scale(${ring.scale})`,
 *       opacity: ring.opacity,
 *     }}
 *   />
 * ))}
 * ```
 */
export function useRippleEffect(config: Partial<RippleConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const [state, setState] = useState<RippleState>(INITIAL_STATE)
  const animationRef = useRef<number | null>(null)
  const thresholdCallbackRef = useRef<(() => void) | null>(null)
  const thresholdReachedRef = useRef(false)
  const { trigger: triggerHaptic } = useHaptics()

  const stopRipple = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    thresholdCallbackRef.current = null
    thresholdReachedRef.current = false
    setState(INITIAL_STATE)
  }, [])

  const startRipple = useCallback((position: Vec2) => {
    stopRipple()

    const startTime = performance.now()
    const { duration, maxScale, ringCount, ringDelay } = mergedConfig

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(1, elapsed / duration)

      // Create rings with staggered timing
      const rings: RippleRing[] = []
      for (let i = 0; i < ringCount; i++) {
        const ringStart = i * ringDelay
        const ringElapsed = elapsed - ringStart

        if (ringElapsed > 0) {
          const ringProgress = Math.min(1, ringElapsed / (duration - ringStart))
          rings.push({
            id: i,
            scale: 1 + (maxScale - 1) * ringProgress,
            opacity: 1 - ringProgress,
            startTime: ringStart,
          })
        }
      }

      setState({
        isActive: true,
        position,
        rings,
        progress,
      })

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        animationRef.current = null
        setState(prev => ({ ...prev, isActive: false }))
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [mergedConfig, stopRipple])

  const startLongPressRipple = useCallback((
    position: Vec2,
    threshold: number,
    onThresholdReached: () => void
  ) => {
    stopRipple()

    const startTime = performance.now()
    thresholdCallbackRef.current = onThresholdReached
    thresholdReachedRef.current = false

    // Long-press uses a different animation:
    // Single ring that grows as the press continues
    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(1, elapsed / threshold)

      // Check if threshold reached
      if (progress >= 1 && !thresholdReachedRef.current) {
        thresholdReachedRef.current = true
        triggerHaptic(GalaxyHaptics.longPress)
        thresholdCallbackRef.current?.()
      }

      // Single ring that fills up
      const rings: RippleRing[] = [{
        id: 0,
        scale: 0.5 + progress * 0.5, // Grow from 0.5 to 1
        opacity: 0.3 + progress * 0.4, // Increase opacity
        startTime: 0,
      }]

      setState({
        isActive: true,
        position,
        rings,
        progress,
      })

      // Continue animation even after threshold for visual feedback
      if (elapsed < threshold * 1.2) {
        animationRef.current = requestAnimationFrame(animate)
      } else if (thresholdReachedRef.current) {
        // Complete - show burst effect
        startRipple(position)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [stopRipple, startRipple, triggerHaptic])

  return {
    state,
    startRipple,
    stopRipple,
    startLongPressRipple,
    config: mergedConfig,
  }
}

export default useRippleEffect
