import { useCallback, useRef } from 'react'
import { type Vec2, vec2 } from '@/types/meditative-capture'

/**
 * Magnetic Attraction Configuration
 */
export interface MagneticConfig {
  /** Distance at which attraction begins (pixels) */
  attractionRadius: number
  /** Distance at which maximum force is applied */
  strongRadius: number
  /** Maximum attraction force (0-1) */
  maxForce: number
  /** Easing curve for force falloff */
  falloff: 'linear' | 'quadratic' | 'exponential'
  /** Whether to apply velocity bias toward the attractor */
  applyVelocityBias: boolean
  /** Velocity bias strength (0-1) */
  velocityBiasStrength: number
}

const DEFAULT_CONFIG: MagneticConfig = {
  attractionRadius: 150,
  strongRadius: 60,
  maxForce: 0.8,
  falloff: 'quadratic',
  applyVelocityBias: true,
  velocityBiasStrength: 0.3,
}

/**
 * Attractor data (e.g., a nebula)
 */
export interface Attractor {
  id: string
  position: Vec2
  radius: number
  /** Optional custom attraction strength (multiplier) */
  strength?: number
}

/**
 * Result of magnetic force calculation
 */
export interface MagneticResult {
  /** The nearest attractor, if within range */
  nearestAttractor: Attractor | null
  /** Distance to nearest attractor */
  distance: number
  /** Normalized attraction strength (0-1) */
  attractionStrength: number
  /** Force vector to apply to the attracted object */
  force: Vec2
  /** Whether the object is within snap range */
  isWithinSnapRange: boolean
  /** Velocity bias to apply (for smooth acceleration) */
  velocityBias: Vec2
}

/**
 * Hook for calculating magnetic attraction between objects
 *
 * Used for the Seed approaching Nebulae. As the Seed gets closer,
 * it experiences increasing magnetic pull toward the nearest nebula.
 *
 * Usage:
 * ```tsx
 * const { calculateAttraction } = useMagneticAttraction({
 *   attractionRadius: 150,
 *   strongRadius: 60,
 * })
 *
 * // On each frame/drag update
 * const result = calculateAttraction(seedPosition, nebulae)
 * if (result.attractionStrength > 0) {
 *   // Apply force to seed
 *   newPosition = vec2.add(seedPosition, result.force)
 * }
 * ```
 */
export function useMagneticAttraction(config: Partial<MagneticConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const lastNearestRef = useRef<string | null>(null)

  /**
   * Calculate falloff based on distance
   */
  const calculateFalloff = useCallback((distance: number, config: MagneticConfig): number => {
    const { attractionRadius, strongRadius, falloff } = config

    if (distance <= strongRadius) {
      return 1 // Maximum force within strong radius
    }

    if (distance >= attractionRadius) {
      return 0 // No force outside attraction radius
    }

    // Normalized distance (0 at strongRadius, 1 at attractionRadius)
    const t = (distance - strongRadius) / (attractionRadius - strongRadius)

    switch (falloff) {
      case 'linear':
        return 1 - t
      case 'quadratic':
        return (1 - t) * (1 - t)
      case 'exponential':
        return Math.exp(-t * 3)
      default:
        return 1 - t
    }
  }, [])

  /**
   * Calculate magnetic attraction from a position toward attractors
   */
  const calculateAttraction = useCallback((
    position: Vec2,
    attractors: Attractor[]
  ): MagneticResult => {
    let nearestAttractor: Attractor | null = null
    let nearestDistance = Infinity

    // Find nearest attractor
    for (const attractor of attractors) {
      const distance = vec2.dist(position, attractor.position)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestAttractor = attractor
      }
    }

    // No attractors or too far
    if (!nearestAttractor || nearestDistance > mergedConfig.attractionRadius) {
      lastNearestRef.current = null
      return {
        nearestAttractor: null,
        distance: nearestDistance,
        attractionStrength: 0,
        force: vec2.zero(),
        isWithinSnapRange: false,
        velocityBias: vec2.zero(),
      }
    }

    // Track if we're entering a new attractor's field
    const isNewAttractor = lastNearestRef.current !== nearestAttractor.id
    lastNearestRef.current = nearestAttractor.id

    // Calculate attraction strength
    const baseFalloff = calculateFalloff(nearestDistance, mergedConfig)
    const attractorStrength = nearestAttractor.strength ?? 1
    const attractionStrength = Math.min(1, baseFalloff * attractorStrength * mergedConfig.maxForce)

    // Calculate direction toward attractor
    const direction = vec2.normalize(
      vec2.sub(nearestAttractor.position, position)
    )

    // Calculate force
    const force = vec2.mul(direction, attractionStrength * 2) // Scale for responsiveness

    // Calculate velocity bias (for smoother acceleration)
    const velocityBias = mergedConfig.applyVelocityBias
      ? vec2.mul(direction, mergedConfig.velocityBiasStrength * attractionStrength)
      : vec2.zero()

    // Check if within snap range (inside the nebula's radius)
    const isWithinSnapRange = nearestDistance < nearestAttractor.radius * 1.2

    return {
      nearestAttractor,
      distance: nearestDistance,
      attractionStrength,
      force,
      isWithinSnapRange,
      velocityBias,
    }
  }, [mergedConfig, calculateFalloff])

  /**
   * Get the color intensity for magnetic glow based on attraction
   * Returns a value from 0 to 1
   */
  const getGlowIntensity = useCallback((attractionStrength: number): number => {
    // Ease the intensity for a smoother visual
    return Math.pow(attractionStrength, 0.7)
  }, [])

  return {
    calculateAttraction,
    getGlowIntensity,
    config: mergedConfig,
  }
}

export default useMagneticAttraction
