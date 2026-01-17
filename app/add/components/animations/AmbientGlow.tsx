'use client'

import { motion } from 'framer-motion'
import { type ReactNode, useMemo } from 'react'

type GlowTheme = 'primary' | 'secondary' | 'warm' | 'cool' | 'rose' | 'custom'

interface AmbientGlowProps {
  children: ReactNode
  /** Color theme for the glow */
  theme?: GlowTheme
  /** Custom colors for the glow [primary, secondary] */
  customColors?: [string, string]
  /** Duration of one complete color cycle */
  duration?: number
  /** Intensity of the glow (1 = normal, 2 = intense) */
  intensity?: number
  /** Additional className */
  className?: string
  /** Whether the glow is active */
  active?: boolean
}

// Theme color definitions
const themeColors: Record<Exclude<GlowTheme, 'custom'>, [string, string]> = {
  primary: ['rgba(99, 102, 241, 0.5)', 'rgba(139, 92, 246, 0.5)'],
  secondary: ['rgba(139, 92, 246, 0.5)', 'rgba(168, 85, 247, 0.5)'],
  warm: ['rgba(245, 158, 11, 0.5)', 'rgba(249, 115, 22, 0.5)'],
  cool: ['rgba(6, 182, 212, 0.5)', 'rgba(59, 130, 246, 0.5)'],
  rose: ['rgba(244, 63, 94, 0.5)', 'rgba(236, 72, 153, 0.5)'],
}

/**
 * AmbientGlow - Iridescent border glow that shifts colors
 *
 * Creates a soft, pulsing glow around elements that shifts
 * between two colors based on the theme.
 */
export function AmbientGlow({
  children,
  theme = 'primary',
  customColors,
  duration = 3,
  intensity = 1,
  className = '',
  active = true,
}: AmbientGlowProps) {
  const colors = theme === 'custom' && customColors
    ? customColors
    : themeColors[theme as Exclude<GlowTheme, 'custom'>]

  const glowShadows = useMemo(() => {
    const baseSize = 20 * intensity
    const midSize = 40 * intensity
    const outerSize = 60 * intensity

    return [
      // State 1
      `0 0 ${baseSize}px ${colors[0]}, 0 0 ${midSize}px ${colors[0].replace('0.5', '0.3')}, 0 0 ${outerSize}px ${colors[0].replace('0.5', '0.15')}`,
      // State 2
      `0 0 ${baseSize}px ${colors[1]}, 0 0 ${midSize}px ${colors[1].replace('0.5', '0.3')}, 0 0 ${outerSize}px ${colors[1].replace('0.5', '0.15')}`,
      // Back to State 1
      `0 0 ${baseSize}px ${colors[0]}, 0 0 ${midSize}px ${colors[0].replace('0.5', '0.3')}, 0 0 ${outerSize}px ${colors[0].replace('0.5', '0.15')}`,
    ]
  }, [colors, intensity])

  const staticShadow = useMemo(() => {
    const baseSize = 20 * intensity
    return `0 0 ${baseSize}px ${colors[0]}`
  }, [colors, intensity])

  return (
    <motion.div
      className={className}
      animate={active ? {
        boxShadow: glowShadows,
      } : {
        boxShadow: staticShadow,
      }}
      transition={{
        duration,
        repeat: active ? Infinity : 0,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * AmbientGlowBorder - A glowing border effect (not box-shadow)
 * Useful for elements where you want a crisp glowing outline
 */
interface AmbientGlowBorderProps {
  children: ReactNode
  theme?: GlowTheme
  customColors?: [string, string]
  duration?: number
  borderWidth?: number
  borderRadius?: string
  className?: string
  active?: boolean
}

export function AmbientGlowBorder({
  children,
  theme = 'primary',
  customColors,
  duration = 3,
  borderWidth = 2,
  borderRadius = '9999px',
  className = '',
  active = true,
}: AmbientGlowBorderProps) {
  const colors = theme === 'custom' && customColors
    ? customColors
    : themeColors[theme as Exclude<GlowTheme, 'custom'>]

  return (
    <motion.div
      className={`relative ${className}`}
      style={{ borderRadius }}
    >
      {/* Glow layer behind */}
      <motion.div
        className="absolute inset-0 -z-10"
        style={{
          borderRadius,
          padding: borderWidth,
        }}
        animate={active ? {
          background: [
            `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
            `linear-gradient(225deg, ${colors[1]}, ${colors[0]})`,
            `linear-gradient(315deg, ${colors[0]}, ${colors[1]})`,
            `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
          ],
          boxShadow: [
            `0 0 20px ${colors[0]}`,
            `0 0 30px ${colors[1]}`,
            `0 0 20px ${colors[0]}`,
          ],
        } : {
          background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        }}
        transition={{
          duration: duration * 2,
          repeat: active ? Infinity : 0,
          ease: 'linear',
        }}
      />
      {/* Content */}
      <div
        className="relative z-10 bg-zen-void"
        style={{ borderRadius }}
      >
        {children}
      </div>
    </motion.div>
  )
}

export default AmbientGlow
