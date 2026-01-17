'use client'

import { motion } from 'framer-motion'
import { type NebulaEdge, type Vec2 } from '@/types/meditative-capture'

interface GalaxyEdgeProps {
  edge: NebulaEdge
  sourcePosition: Vec2
  targetPosition: Vec2
  /** Whether to show the edge label */
  showLabel?: boolean
}

/**
 * GalaxyEdge - A connection line between two nebulae
 *
 * Features:
 * - Curved bezier path
 * - Animated dash pattern
 * - Opacity based on relationship strength
 */
export function GalaxyEdge({
  edge,
  sourcePosition,
  targetPosition,
  showLabel = false,
}: GalaxyEdgeProps) {
  // Calculate control points for bezier curve
  const midX = (sourcePosition.x + targetPosition.x) / 2
  const midY = (sourcePosition.y + targetPosition.y) / 2

  // Perpendicular offset for curve
  const dx = targetPosition.x - sourcePosition.x
  const dy = targetPosition.y - sourcePosition.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const curveOffset = length * 0.2

  // Control point perpendicular to line
  const controlX = midX - (dy / length) * curveOffset
  const controlY = midY + (dx / length) * curveOffset

  const pathD = `M ${sourcePosition.x} ${sourcePosition.y} Q ${controlX} ${controlY} ${targetPosition.x} ${targetPosition.y}`

  return (
    <g>
      {/* Main edge line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={`rgba(139, 92, 246, ${edge.strength * 0.4})`}
        strokeWidth={1 + edge.strength}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />

      {/* Animated dash overlay */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={`rgba(99, 102, 241, ${edge.strength * 0.3})`}
        strokeWidth={1}
        strokeDasharray="4 8"
        strokeLinecap="round"
        animate={{
          strokeDashoffset: [0, -24],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Label */}
      {showLabel && edge.label && (
        <motion.text
          x={midX}
          y={midY - 10}
          textAnchor="middle"
          fill="rgba(156, 163, 175, 0.6)"
          fontSize={10}
          fontFamily="var(--font-data)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {edge.label}
        </motion.text>
      )}
    </g>
  )
}

export default GalaxyEdge
