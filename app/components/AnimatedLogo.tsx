'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'

type AnimatedLogoProps = {
  size?: number
  className?: string
  variant?: 'light' | 'dark' | 'auto'
  isProcessing?: boolean
}

export function AnimatedLogo({
  size = 120,
  className = '',
  variant = 'auto',
  isProcessing = false
}: AnimatedLogoProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Determine colors based on variant and theme
  const isDark = variant === 'dark'
  const isLight = variant === 'light'

  // Animation variants for the orbs
  const orbVariants = {
    idle: (i: number) => ({
      x: [0, 5, -5, 0],
      y: [0, -8, 4, 0],
      transition: {
        duration: 4 + i,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }),
    hover: {
      scale: 1.2,
      filter: "brightness(1.4) blur(4px)",
      transition: { type: "spring", stiffness: 300, damping: 20 }
    }
  }

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        aria-label="Trove - Personal Knowledge Graph"
      >
        <defs>
          {/* Gradient for the Orbs */}
          <radialGradient id="orbGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A855F7" /> {/* Electric Violet */}
            <stop offset="100%" stopColor="#F43F5E" /> {/* Sunset Rose */}
          </radialGradient>

          {/* Glow Filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* --- The T-Trunk (Objective Data) --- */}
        <g
          stroke="var(--color-indigo-accent, #6366F1)"
          strokeLinecap="round"
          opacity="0.9"
        >
          {/* Main Vertical Trunk */}
          <line x1="50" y1="30" x2="50" y2="85" strokeWidth="3" />
          <line x1="46" y1="35" x2="46" y2="80" strokeWidth="0.5" opacity="0.5" />
          <line x1="54" y1="35" x2="54" y2="80" strokeWidth="0.5" opacity="0.5" />

          {/* Horizontal Branching (Subjective Context) */}
          <motion.path
            d="M20 30 Q 50 30 80 30"
            fill="transparent"
            strokeWidth="3"
            animate={{ strokeDashoffset: isProcessing ? [0, -20] : 0 }}
            style={{ strokeDasharray: "4 2" }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />
        </g>

        {/* --- The Soft-Glow Orbs (Personal Context) --- */}
        {[
          { id: 1, cx: 20, cy: 30, size: 5 },
          { id: 2, cx: 80, cy: 30, size: 6 },
          { id: 3, cx: 50, cy: 25, size: 4 },
          { id: 4, cx: 65, cy: 45, size: 4 }
        ].map((orb, i) => (
          <motion.circle
            key={orb.id}
            cx={orb.cx}
            cy={orb.cy}
            r={orb.size}
            fill="url(#orbGradient)"
            filter="url(#glow)"
            custom={i}
            variants={orbVariants}
            animate={isProcessing ? {
              scale: [1, 1.4, 1],
              opacity: [0.6, 1, 0.6],
              transition: { repeat: Infinity, duration: 1.5 }
            } : "idle"}
            whileHover="hover"
            style={{
              // Magnetism: Pull towards center on hover
              translateX: isHovered ? (50 - orb.cx) * 0.15 : 0,
              translateY: isHovered ? (35 - orb.cy) * 0.15 : 0,
            }}
          />
        ))}

        {/* Primary T nodes - anchors for the structure */}
        <motion.circle
          cx="20"
          cy="30"
          r="6"
          fill={variant === 'auto' ? 'var(--color-carbon, #1A1A1A)' : isLight ? '#FFFFFF' : '#1A1A1A'}
          stroke="var(--color-indigo-accent, #6366F1)"
          strokeWidth="2"
          animate={isHovered ? { scale: 1.1 } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
        <motion.circle
          cx="80"
          cy="30"
          r="6"
          fill={variant === 'auto' ? 'var(--color-carbon, #1A1A1A)' : isLight ? '#FFFFFF' : '#1A1A1A'}
          stroke="var(--color-indigo-accent, #6366F1)"
          strokeWidth="2"
          animate={isHovered ? { scale: 1.1 } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
        <motion.circle
          cx="50"
          cy="30"
          r="7"
          fill={variant === 'auto' ? 'var(--color-carbon, #1A1A1A)' : isLight ? '#FFFFFF' : '#1A1A1A'}
          stroke="var(--color-indigo-accent, #6366F1)"
          strokeWidth="2"
          animate={isHovered ? { scale: 1.15 } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
        <motion.circle
          cx="50"
          cy="85"
          r="6"
          fill={variant === 'auto' ? 'var(--color-carbon, #1A1A1A)' : isLight ? '#FFFFFF' : '#1A1A1A'}
          stroke="var(--color-indigo-accent, #6366F1)"
          strokeWidth="2"
          animate={isHovered ? { scale: 1.1 } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />

        {/* Center accent dot */}
        <motion.circle
          cx="50"
          cy="30"
          r="2.5"
          fill="var(--color-indigo-accent, #6366F1)"
          animate={isProcessing ? {
            scale: [1, 1.5, 1],
            opacity: [1, 0.5, 1],
            transition: { repeat: Infinity, duration: 1.5 }
          } : {}}
        />
      </svg>
    </div>
  )
}

// Icon-only variant for mobile/favicon
export function AnimatedLogoIcon({
  size = 48,
  className = '',
  isProcessing = false
}: Pick<AnimatedLogoProps, 'size' | 'className' | 'isProcessing'>) {
  return (
    <AnimatedLogo size={size} className={className} isProcessing={isProcessing} />
  )
}
