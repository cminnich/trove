import { useCallback, useRef, useState } from 'react'
import { type Vec2, vec2 } from '@/types/meditative-capture'
import { useHaptics, GalaxyHaptics } from './useHaptics'

/**
 * Snap Animation Phases
 *
 * The Snap is an 800ms animation sequence:
 * 1. Accelerate (200ms): Seed speeds toward nebula center
 * 2. Approach (300ms): Seed shrinks and brightens
 * 3. Pulse (150ms): Iridescent glow ring + haptic
 * 4. Settle (150ms): Spring settle into orbit position
 */
export type SnapPhase =
  | 'idle'
  | 'accelerate'
  | 'approach'
  | 'pulse'
  | 'settle'
  | 'complete'

/**
 * Snap animation state
 */
export interface SnapState {
  phase: SnapPhase
  /** Current position during animation */
  position: Vec2
  /** Current scale (0-1) */
  scale: number
  /** Current brightness multiplier (1 = normal, 1.5 = bright) */
  brightness: number
  /** Whether pulse ring is visible */
  showPulseRing: boolean
  /** Pulse ring scale (for expanding animation) */
  pulseRingScale: number
  /** Pulse ring opacity */
  pulseRingOpacity: number
  /** Final orbit position after settle */
  orbitPosition: Vec2
  /** Progress through current phase (0-1) */
  phaseProgress: number
}

const INITIAL_STATE: SnapState = {
  phase: 'idle',
  position: vec2.zero(),
  scale: 1,
  brightness: 1,
  showPulseRing: false,
  pulseRingScale: 0,
  pulseRingOpacity: 0,
  orbitPosition: vec2.zero(),
  phaseProgress: 0,
}

/**
 * Phase durations in milliseconds
 */
const PHASE_DURATIONS: Record<SnapPhase, number> = {
  idle: 0,
  accelerate: 200,
  approach: 300,
  pulse: 150,
  settle: 150,
  complete: 0,
}

/**
 * Easing functions
 */
const ease = {
  in: (t: number) => t * t,
  out: (t: number) => 1 - Math.pow(1 - t, 2),
  inOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  spring: (t: number, damping = 0.4) => {
    // Damped spring easing
    const w = Math.PI * 2 * 1.5 // frequency
    return 1 - Math.exp(-t * 5) * Math.cos(w * t) * damping
  },
}

/**
 * Calculate orbit position around nebula
 */
function calculateOrbitPosition(
  nebulaCenter: Vec2,
  nebulaRadius: number,
  angle: number = Math.random() * Math.PI * 2
): Vec2 {
  const orbitRadius = nebulaRadius + 20 // Slightly outside the nebula
  return {
    x: nebulaCenter.x + Math.cos(angle) * orbitRadius,
    y: nebulaCenter.y + Math.sin(angle) * orbitRadius,
  }
}

interface UseSnapAnimationReturn {
  /** Current animation state */
  state: SnapState
  /** Whether an animation is in progress */
  isAnimating: boolean
  /** Start the snap animation */
  startSnap: (
    startPosition: Vec2,
    nebulaCenter: Vec2,
    nebulaRadius: number,
    onComplete?: () => void
  ) => void
  /** Reset to idle state */
  reset: () => void
  /** Get CSS transform for the seed during animation */
  getTransform: () => string
  /** Get CSS filter for brightness effect */
  getFilter: () => string
}

/**
 * Hook for managing the Snap animation sequence
 *
 * Usage:
 * ```tsx
 * const { state, startSnap, getTransform, getFilter } = useSnapAnimation()
 *
 * // On placement
 * startSnap(seedPosition, nebulaCenter, nebulaRadius, () => {
 *   // Animation complete - transition to inquiry phase
 * })
 *
 * // In render
 * <motion.div style={{ transform: getTransform(), filter: getFilter() }}>
 *   <Seed />
 *   {state.showPulseRing && <PulseRing scale={state.pulseRingScale} />}
 * </motion.div>
 * ```
 */
export function useSnapAnimation(): UseSnapAnimationReturn {
  const [state, setState] = useState<SnapState>(INITIAL_STATE)
  const animationRef = useRef<number | null>(null)
  const onCompleteRef = useRef<(() => void) | null>(null)
  const { trigger: triggerHaptic } = useHaptics()

  const reset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    setState(INITIAL_STATE)
  }, [])

  const startSnap = useCallback((
    startPosition: Vec2,
    nebulaCenter: Vec2,
    nebulaRadius: number,
    onComplete?: () => void
  ) => {
    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    onCompleteRef.current = onComplete || null

    // Calculate orbit position for final settle
    const orbitPosition = calculateOrbitPosition(nebulaCenter, nebulaRadius)

    // Animation state
    let currentPhase: SnapPhase = 'accelerate'
    let phaseStartTime = performance.now()
    let currentPosition = { ...startPosition }
    let currentScale = 1
    let currentBrightness = 1

    const animate = (timestamp: number) => {
      const elapsed = timestamp - phaseStartTime
      const phaseDuration = PHASE_DURATIONS[currentPhase]
      const phaseProgress = Math.min(1, elapsed / phaseDuration)

      switch (currentPhase) {
        case 'accelerate': {
          // Move toward nebula center with acceleration
          const t = ease.in(phaseProgress)
          const midPoint = {
            x: startPosition.x + (nebulaCenter.x - startPosition.x) * 0.3,
            y: startPosition.y + (nebulaCenter.y - startPosition.y) * 0.3,
          }
          currentPosition = {
            x: startPosition.x + (midPoint.x - startPosition.x) * t,
            y: startPosition.y + (midPoint.y - startPosition.y) * t,
          }
          currentScale = 1 - 0.1 * t // Start shrinking
          break
        }

        case 'approach': {
          // Continue toward center, shrink more, brighten
          const t = ease.out(phaseProgress)
          const midPoint = {
            x: startPosition.x + (nebulaCenter.x - startPosition.x) * 0.3,
            y: startPosition.y + (nebulaCenter.y - startPosition.y) * 0.3,
          }
          currentPosition = {
            x: midPoint.x + (nebulaCenter.x - midPoint.x) * t,
            y: midPoint.y + (nebulaCenter.y - midPoint.y) * t,
          }
          currentScale = 0.9 - 0.3 * t // Continue shrinking to 0.6
          currentBrightness = 1 + 0.5 * t // Brighten to 1.5
          break
        }

        case 'pulse': {
          // Hold position, show pulse ring, trigger haptic
          if (phaseProgress < 0.1) {
            triggerHaptic(GalaxyHaptics.snap)
          }

          setState(prev => ({
            ...prev,
            phase: 'pulse',
            position: nebulaCenter,
            scale: 0.6,
            brightness: 1.5 - 0.3 * phaseProgress, // Fade brightness
            showPulseRing: true,
            pulseRingScale: 1 + phaseProgress * 2, // Expand ring
            pulseRingOpacity: 1 - phaseProgress, // Fade out ring
            phaseProgress,
          }))

          if (phaseProgress >= 1) {
            currentPhase = 'settle'
            phaseStartTime = timestamp
          }

          animationRef.current = requestAnimationFrame(animate)
          return
        }

        case 'settle': {
          // Spring to orbit position
          const t = ease.spring(phaseProgress, 0.3)
          currentPosition = {
            x: nebulaCenter.x + (orbitPosition.x - nebulaCenter.x) * t,
            y: nebulaCenter.y + (orbitPosition.y - nebulaCenter.y) * t,
          }
          currentScale = 0.6 - 0.1 * t // Settle to 0.5

          setState(prev => ({
            ...prev,
            phase: 'settle',
            position: currentPosition,
            scale: currentScale,
            brightness: 1.2 - 0.2 * t, // Return to normal
            showPulseRing: false,
            orbitPosition,
            phaseProgress,
          }))

          if (phaseProgress >= 1) {
            setState(prev => ({
              ...prev,
              phase: 'complete',
              position: orbitPosition,
              scale: 0.5,
              brightness: 1,
            }))

            animationRef.current = null
            onCompleteRef.current?.()
            return
          }

          animationRef.current = requestAnimationFrame(animate)
          return
        }
      }

      // Update state for accelerate/approach phases
      setState(prev => ({
        ...prev,
        phase: currentPhase,
        position: currentPosition,
        scale: currentScale,
        brightness: currentBrightness,
        orbitPosition,
        phaseProgress,
      }))

      // Transition to next phase
      if (phaseProgress >= 1) {
        const phases: SnapPhase[] = ['accelerate', 'approach', 'pulse', 'settle']
        const currentIndex = phases.indexOf(currentPhase)
        if (currentIndex < phases.length - 1) {
          currentPhase = phases[currentIndex + 1]
          phaseStartTime = timestamp
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    // Start animation
    setState({
      phase: 'accelerate',
      position: startPosition,
      scale: 1,
      brightness: 1,
      showPulseRing: false,
      pulseRingScale: 0,
      pulseRingOpacity: 0,
      orbitPosition,
      phaseProgress: 0,
    })

    animationRef.current = requestAnimationFrame(animate)
  }, [triggerHaptic])

  const getTransform = useCallback((): string => {
    const { position, scale } = state
    return `translate(${position.x}px, ${position.y}px) scale(${scale})`
  }, [state])

  const getFilter = useCallback((): string => {
    const { brightness } = state
    return brightness !== 1 ? `brightness(${brightness})` : ''
  }, [state])

  const isAnimating = state.phase !== 'idle' && state.phase !== 'complete'

  return {
    state,
    isAnimating,
    startSnap,
    reset,
    getTransform,
    getFilter,
  }
}

export default useSnapAnimation
