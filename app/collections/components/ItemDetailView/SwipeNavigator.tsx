'use client'

import { ReactNode, useCallback } from 'react'
import { motion, useAnimation, PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SwipeNavigatorProps {
  children: ReactNode
  onSwipeLeft: () => void
  onSwipeRight: () => void
  canSwipeLeft: boolean
  canSwipeRight: boolean
  currentIndex: number
}

const DRAG_THRESHOLD = 50 // px to trigger navigation
const VELOCITY_THRESHOLD = 500 // px/s to trigger navigation

export function SwipeNavigator({
  children,
  onSwipeLeft,
  onSwipeRight,
  canSwipeLeft,
  canSwipeRight,
  currentIndex,
}: SwipeNavigatorProps) {
  const controls = useAnimation()

  const handleDragEnd = useCallback(
    async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info

      // Check if swipe was fast enough or far enough
      const swipeLeft =
        (offset.x < -DRAG_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) && canSwipeRight
      const swipeRight =
        (offset.x > DRAG_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) && canSwipeLeft

      if (swipeLeft) {
        // Animate out to the left, then trigger navigation
        await controls.start({
          x: -window.innerWidth,
          opacity: 0,
          transition: { duration: 0.2 },
        })
        onSwipeLeft()
        // Reset position instantly
        controls.set({ x: window.innerWidth, opacity: 0 })
        // Animate in from the right
        await controls.start({
          x: 0,
          opacity: 1,
          transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
      } else if (swipeRight) {
        // Animate out to the right, then trigger navigation
        await controls.start({
          x: window.innerWidth,
          opacity: 0,
          transition: { duration: 0.2 },
        })
        onSwipeRight()
        // Reset position instantly
        controls.set({ x: -window.innerWidth, opacity: 0 })
        // Animate in from the left
        await controls.start({
          x: 0,
          opacity: 1,
          transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
      } else {
        // Spring back to center
        await controls.start({
          x: 0,
          transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
      }
    },
    [controls, onSwipeLeft, onSwipeRight, canSwipeLeft, canSwipeRight]
  )

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Navigation arrows - desktop only */}
      {canSwipeLeft && (
        <button
          onClick={onSwipeRight}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
          aria-label="Previous item"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
      )}
      {canSwipeRight && (
        <button
          onClick={onSwipeLeft}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
          aria-label="Next item"
        >
          <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
      )}

      {/* Swipeable content */}
      <motion.div
        key={currentIndex}
        className="w-full h-full touch-pan-y"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={controls}
        initial={{ opacity: 1, x: 0 }}
      >
        {children}
      </motion.div>

      {/* Edge indicators during drag */}
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-indigo-500/20 to-transparent pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: canSwipeLeft ? 0.5 : 0 }}
      />
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-indigo-500/20 to-transparent pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: canSwipeRight ? 0.5 : 0 }}
      />
    </div>
  )
}
