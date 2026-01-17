'use client'

import { motion, type Variants } from 'framer-motion'
import { type ReactNode } from 'react'

interface ProgressiveRevealProps {
  children: ReactNode
  /** Delay before this element appears (in seconds) */
  delay?: number
  /** Duration of the reveal animation */
  duration?: number
  /** Distance to travel upward during reveal */
  yOffset?: number
  /** Additional className */
  className?: string
  /** Trigger the reveal animation */
  show?: boolean
}

const revealVariants: Variants = {
  hidden: (yOffset: number) => ({
    opacity: 0,
    y: yOffset,
  }),
  visible: {
    opacity: 1,
    y: 0,
  },
}

/**
 * ProgressiveReveal - Staggered fade-in with upward motion
 *
 * Elements fade in gracefully with a subtle upward drift,
 * building narrative one piece at a time.
 */
export function ProgressiveReveal({
  children,
  delay = 0,
  duration = 0.8,
  yOffset = 20,
  className = '',
  show = true,
}: ProgressiveRevealProps) {
  return (
    <motion.div
      className={className}
      custom={yOffset}
      variants={revealVariants}
      initial="hidden"
      animate={show ? 'visible' : 'hidden'}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94], // Smooth ease-out curve
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * ProgressiveRevealGroup - Container for staggering multiple reveals
 */
interface ProgressiveRevealGroupProps {
  children: ReactNode
  /** Base delay before first element */
  baseDelay?: number
  /** Delay between each child element */
  stagger?: number
  /** Whether to show the group */
  show?: boolean
  className?: string
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

export function ProgressiveRevealGroup({
  children,
  baseDelay = 0,
  stagger = 0.15,
  show = true,
  className = '',
}: ProgressiveRevealGroupProps) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: stagger,
            delayChildren: baseDelay,
          },
        },
      }}
      initial="hidden"
      animate={show ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}

export function ProgressiveRevealItem({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}

export default ProgressiveReveal
