import { useCallback } from 'react'

/**
 * Haptic Feedback Types
 *
 * Based on iOS UIImpactFeedbackGenerator styles.
 * Falls back to navigator.vibrate on Android/web.
 */
export type HapticStyle =
  | 'light'      // Subtle feedback (approaching)
  | 'medium'     // Standard feedback (selection)
  | 'heavy'      // Strong feedback (The Snap)
  | 'rigid'      // Quick, sharp feedback
  | 'soft'       // Gentle, elastic feedback
  | 'success'    // Success pattern (completion)
  | 'warning'    // Warning pattern
  | 'error'      // Error pattern
  | 'selection'  // Selection tick

/**
 * Vibration patterns for each haptic style (in milliseconds)
 * Used as fallback when native haptics aren't available
 */
const VIBRATION_PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  rigid: 15,
  soft: 25,
  success: [10, 50, 10],
  warning: [30, 50, 30],
  error: [50, 50, 50, 50, 50],
  selection: 5,
}

/**
 * Check if the device supports haptic feedback
 */
function supportsHaptics(): boolean {
  if (typeof window === 'undefined') return false

  // iOS Safari with Taptic Engine
  if ('ontouchstart' in window && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    return true
  }

  // Vibration API (Android, some browsers)
  return 'vibrate' in navigator
}

/**
 * Check if we're on iOS (for native-quality haptics)
 */
function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

interface UseHapticsReturn {
  /**
   * Trigger a haptic feedback
   */
  trigger: (style: HapticStyle) => void

  /**
   * Whether haptics are supported on this device
   */
  isSupported: boolean

  /**
   * Trigger a custom vibration pattern
   * @param pattern Array of durations in ms [vibrate, pause, vibrate, ...]
   */
  vibrate: (pattern: number | number[]) => void
}

/**
 * Hook for triggering haptic feedback
 *
 * Usage:
 * ```tsx
 * const { trigger, isSupported } = useHaptics()
 *
 * // On snap
 * trigger('heavy')
 *
 * // On approach
 * trigger('light')
 *
 * // On success
 * trigger('success')
 * ```
 */
export function useHaptics(): UseHapticsReturn {
  const isSupported = supportsHaptics()

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern)
      } catch {
        // Silently fail if vibration is blocked
      }
    }
  }, [])

  const trigger = useCallback((style: HapticStyle) => {
    if (!isSupported) return

    // On iOS, we rely on the browser's native haptic engine via user interaction
    // The Vibration API provides a fallback for Android/web
    if (isIOS()) {
      // iOS Safari doesn't expose Taptic Engine directly, but we can use
      // AudioContext to trigger haptics on some devices, or fall back to vibration
      // For now, we use the vibration API which works on most mobile browsers
      vibrate(VIBRATION_PATTERNS[style])
    } else {
      // Android/Web fallback
      vibrate(VIBRATION_PATTERNS[style])
    }
  }, [isSupported, vibrate])

  return {
    trigger,
    isSupported,
    vibrate,
  }
}

/**
 * Haptic feedback presets for common Galaxy interactions
 */
export const GalaxyHaptics = {
  /** When seed enters nebula's gravitational field */
  approach: 'light' as HapticStyle,

  /** When seed gets closer to nebula center */
  intensify: 'medium' as HapticStyle,

  /** The Snap - when seed commits to nebula */
  snap: 'heavy' as HapticStyle,

  /** When swiping between items in HUD */
  swipe: 'selection' as HapticStyle,

  /** When long-press threshold is reached */
  longPress: 'rigid' as HapticStyle,

  /** When a new nebula is created */
  create: 'success' as HapticStyle,

  /** When an action fails */
  error: 'error' as HapticStyle,
} as const

export default useHaptics
