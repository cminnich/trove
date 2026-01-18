'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { type SeedState } from '@/types/meditative-capture'
import { BreathingPulse } from '@/app/add/components/animations'

interface SeedProps {
  seed: SeedState
  /** Whether to show extraction progress */
  showProgress?: boolean
  /** Size of the seed in pixels */
  size?: number
}

/**
 * Seed - The glowing orb representing a new item at the center
 *
 * Features:
 * - Fixed at center (0,0) as the visual focal point
 * - Breathing pulse animation
 * - Shows item thumbnail when extracted
 * - Glowing aura effect
 */
export function Seed({
  seed,
  showProgress = true,
  size = 80,
}: SeedProps) {
  const isExtracting = seed.extraction.status === 'in_progress' || seed.extraction.status === 'pending'
  const progress = seed.extraction.status === 'in_progress' ? seed.extraction.progress : 0

  return (
    <motion.div
      className="absolute"
      style={{
        width: size,
        height: size,
        // Fixed at center (0,0), offset by half size to center visually
        left: 0,
        top: 0,
        x: -size / 2,
        y: -size / 2,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <BreathingPulse
        duration={4}
        scale={1.05}
        className="w-full h-full"
        active={true}
      >
        {/* Outer glow */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)',
            transform: 'scale(1.8)',
            filter: 'blur(20px)',
          }}
        />

        {/* Middle glow layer - subtle pulsing glow */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 20px rgba(99, 102, 241, 0.5), 0 0 40px rgba(139, 92, 246, 0.3)',
              '0 0 30px rgba(139, 92, 246, 0.5), 0 0 60px rgba(99, 102, 241, 0.3)',
              '0 0 20px rgba(99, 102, 241, 0.5), 0 0 40px rgba(139, 92, 246, 0.3)',
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Core seed */}
        <div
          className="relative w-full h-full rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {/* Item thumbnail */}
          {seed.imageUrl && (
            <Image
              src={seed.imageUrl}
              alt={seed.title || 'Item'}
              fill
              className="object-cover"
              sizes={`${size}px`}
            />
          )}

          {/* Extraction progress overlay */}
          {isExtracting && showProgress && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <svg className="w-8 h-8" viewBox="0 0 36 36">
                {/* Background circle */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth="2"
                />
                {/* Progress circle */}
                <motion.circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.9)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={100}
                  strokeDashoffset={100 - progress}
                  transform="rotate(-90 18 18)"
                  initial={{ strokeDashoffset: 100 }}
                  animate={{ strokeDashoffset: 100 - progress }}
                  transition={{ duration: 0.3 }}
                />
              </svg>
            </div>
          )}
        </div>

        {/* Title label */}
        {seed.title && !isExtracting && (
          <motion.div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-xs text-zen-text-reflective/80 font-data bg-zen-void/80 px-2 py-1 rounded">
              {seed.title.length > 20 ? seed.title.slice(0, 20) + '...' : seed.title}
            </span>
          </motion.div>
        )}
      </BreathingPulse>
    </motion.div>
  )
}

export default Seed
