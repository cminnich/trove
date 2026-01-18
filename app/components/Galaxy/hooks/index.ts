/**
 * Galaxy Animation & Interaction Hooks
 *
 * This module provides hooks for the Galaxy spatial experience:
 *
 * - useWorldCoordinates: Unified coordinate system for SVG and DOM alignment
 * - useHaptics: Cross-platform haptic feedback
 * - useMagneticAttraction: Physics for seed approaching nebulae
 * - useSnapAnimation: The Snap animation sequence
 * - useRippleEffect: Visual feedback for touches and long-presses
 */

export { useWorldCoordinates, type WorldCoordinates, type WorldCoordinatesConfig } from './useWorldCoordinates'
export { useHaptics, GalaxyHaptics, type HapticStyle } from './useHaptics'
export { useMagneticAttraction, type MagneticConfig, type Attractor, type MagneticResult } from './useMagneticAttraction'
export { useSnapAnimation, type SnapState, type SnapPhase } from './useSnapAnimation'
export { useRippleEffect, type RippleConfig, type RippleState, type RippleRing } from './useRippleEffect'
