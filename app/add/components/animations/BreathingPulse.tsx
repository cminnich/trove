'use client'

import { motion, type Variants } from 'framer-motion'
import { type ReactNode } from 'react'

interface BreathingPulseProps {
  children: ReactNode
  /** Duration of one complete breath cycle in seconds */
  duration?: number
  /** Scale factor at peak of breath (1.03 = 3% larger) */
  scale?: number
  /** Minimum opacity during exhale */
  minOpacity?: number
  /** Maximum opacity during inhale */
  maxOpacity?: number
  /** Additional className */
  className?: string
  /** Whether animation is active */
  active?: boolean
}

const createBreathingVariants = (
  scale: number,
  minOpacity: number,
  maxOpacity: number
): Variants => ({
  breathe: {
    scale: [1, scale, 1],
    opacity: [minOpacity, maxOpacity, minOpacity],
  },
  still: {
    scale: 1,
    opacity: maxOpacity,
  },
})

/**
 * BreathingPulse - A slow, meditative scale animation
 *
 * Creates a gentle breathing effect with scale pulsing from 1 to 1.03
 * over a 4-second cycle, evoking calm and presence.
 */
export function BreathingPulse({
  children,
  duration = 4,
  scale = 1.03,
  minOpacity = 0.85,
  maxOpacity = 1,
  className = '',
  active = true,
}: BreathingPulseProps) {
  const variants = createBreathingVariants(scale, minOpacity, maxOpacity)

  return (
    <motion.div
      className={className}
      variants={variants}
      animate={active ? 'breathe' : 'still'}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  )
}

export default BreathingPulse
