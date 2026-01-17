'use client'

import { useCallback, useRef, useEffect } from 'react'
import { type Nebula, type Vec2, vec2 } from '@/types/meditative-capture'

interface PhysicsConfig {
  /** Repulsion force between nebulae */
  repulsion: number
  /** Damping factor (0-1) */
  damping: number
  /** Minimum distance between nebulae */
  minDistance: number
  /** Whether physics simulation is active */
  active: boolean
}

const DEFAULT_CONFIG: PhysicsConfig = {
  repulsion: 5000,
  damping: 0.9,
  minDistance: 100,
  active: true,
}

interface UseGalaxyPhysicsOptions {
  nebulae: Nebula[]
  onUpdate: (nebulae: Nebula[]) => void
  config?: Partial<PhysicsConfig>
}

/**
 * useGalaxyPhysics - Simple force-directed simulation for nebula positioning
 *
 * Features:
 * - Nebulae repel each other
 * - Gravitational attraction toward center
 * - Damping for smooth settling
 */
export function useGalaxyPhysics({
  nebulae,
  onUpdate,
  config: userConfig,
}: UseGalaxyPhysicsOptions) {
  const config = { ...DEFAULT_CONFIG, ...userConfig }
  const velocitiesRef = useRef<Map<string, Vec2>>(new Map())
  const frameRef = useRef<number | null>(null)

  // Initialize velocities for new nebulae
  useEffect(() => {
    nebulae.forEach(nebula => {
      if (!velocitiesRef.current.has(nebula.id)) {
        velocitiesRef.current.set(nebula.id, vec2.zero())
      }
    })
  }, [nebulae])

  // Physics simulation step
  const simulate = useCallback(() => {
    if (!config.active || nebulae.length < 2) return

    const updatedNebulae = nebulae.map(nebula => {
      let force = vec2.zero()
      const velocity = velocitiesRef.current.get(nebula.id) || vec2.zero()

      // Repulsion from other nebulae
      nebulae.forEach(other => {
        if (other.id === nebula.id) return

        const diff = vec2.sub(nebula.position, other.position)
        const distance = Math.max(vec2.len(diff), config.minDistance)
        const direction = vec2.normalize(diff)
        const strength = config.repulsion / (distance * distance)

        force = vec2.add(force, vec2.mul(direction, strength))
      })

      // Weak attraction toward center
      const centerForce = vec2.mul(nebula.position, -0.01)
      force = vec2.add(force, centerForce)

      // Update velocity with damping
      const newVelocity = vec2.mul(
        vec2.add(velocity, force),
        config.damping
      )

      velocitiesRef.current.set(nebula.id, newVelocity)

      // Update position
      const newPosition = vec2.add(nebula.position, newVelocity)

      return {
        ...nebula,
        position: newPosition,
      }
    })

    // Only update if positions have changed significantly
    const hasChanged = updatedNebulae.some((nebula, i) => {
      const velocity = velocitiesRef.current.get(nebula.id) || vec2.zero()
      return vec2.len(velocity) > 0.1
    })

    if (hasChanged) {
      onUpdate(updatedNebulae)
    }
  }, [nebulae, onUpdate, config])

  // Run simulation loop
  useEffect(() => {
    if (!config.active) return

    let lastTime = performance.now()

    const loop = (time: number) => {
      const delta = time - lastTime

      // Run at ~30fps
      if (delta > 33) {
        simulate()
        lastTime = time
      }

      frameRef.current = requestAnimationFrame(loop)
    }

    frameRef.current = requestAnimationFrame(loop)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [config.active, simulate])

  // Apply impulse to a nebula
  const applyImpulse = useCallback((nebulaId: string, impulse: Vec2) => {
    const currentVelocity = velocitiesRef.current.get(nebulaId) || vec2.zero()
    velocitiesRef.current.set(nebulaId, vec2.add(currentVelocity, impulse))
  }, [])

  // Reset velocities
  const resetPhysics = useCallback(() => {
    velocitiesRef.current.clear()
  }, [])

  return {
    applyImpulse,
    resetPhysics,
  }
}

export default useGalaxyPhysics
