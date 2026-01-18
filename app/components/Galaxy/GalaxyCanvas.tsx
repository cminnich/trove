'use client'

import { useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Seed } from './Seed'
import { Nebula } from './Nebula'
import { useGalaxyPhysics } from './useGalaxyPhysics'
import { useGalaxyGestures } from './useGalaxyGestures'
import { useWorldCoordinates } from './hooks/useWorldCoordinates'
import {
  type GalaxyState,
  type SeedState,
  type Vec2,
  type Nebula as NebulaType,
} from '@/types/meditative-capture'

interface GalaxyCanvasProps {
  /** Galaxy state with nebulae */
  galaxy: GalaxyState
  /** Seed state (only in capture mode) */
  seed?: SeedState
  /** Mode: capture (placing seed) or browse (exploring) */
  mode: 'capture' | 'browse'
  /** Called when seed is placed into a nebula (tap-to-place) */
  onSeedPlaced?: (collectionId: string) => void
  /** Called when long-press creates new nebula position */
  onStartNebulaCreation?: (position: Vec2) => void
  /** Called when nebulae positions update (physics) */
  onNebulaeUpdate?: (nebulae: NebulaType[]) => void
  /** Called when view transform changes */
  onViewTransformChange?: (transform: { x: number; y: number; scale: number }) => void
  /** Additional className */
  className?: string
}

/**
 * GalaxyCanvas - The spatial visualization of collections and items
 *
 * Features:
 * - Collections arranged around center with seed as focal point
 * - Tap-to-place: tap a collection to place the item
 * - Pan/zoom navigation
 * - Long-press to create new nebula
 */
export function GalaxyCanvas({
  galaxy,
  seed,
  mode,
  onSeedPlaced,
  onStartNebulaCreation,
  onNebulaeUpdate,
  onViewTransformChange,
  className = '',
}: GalaxyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCreatingNebula, setIsCreatingNebula] = useState(false)
  const [newNebulaPosition, setNewNebulaPosition] = useState<Vec2 | null>(null)

  // Unified world coordinate system
  const worldCoords = useWorldCoordinates({
    viewTransform: galaxy.viewTransform,
    containerRef,
  })

  // Physics simulation
  useGalaxyPhysics({
    nebulae: galaxy.nebulae,
    onUpdate: (updatedNebulae) => {
      onNebulaeUpdate?.(updatedNebulae)
    },
    config: {
      active: mode === 'browse', // Only run physics in browse mode
    },
  })

  // Gesture handling
  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
  } = useGalaxyGestures({
    transform: galaxy.viewTransform,
    onTransformChange: (transform) => {
      onViewTransformChange?.(transform)
    },
    onLongPress: (screenPosition) => {
      if (mode === 'capture') {
        // Convert screen position to world coordinates
        const worldPosition = worldCoords.screenToWorld(screenPosition)
        setIsCreatingNebula(true)
        setNewNebulaPosition(worldPosition)
        onStartNebulaCreation?.(worldPosition)
      }
    },
  })

  // Handle tap-to-place: tap a collection to place the item
  const handleNebulaClick = useCallback((nebulaId: string) => {
    if (mode === 'capture' && seed) {
      onSeedPlaced?.(nebulaId)
    }
  }, [mode, seed, onSeedPlaced])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-zen-void touch-none ${className}`}
      onMouseDown={(e) => containerRef.current && handlePointerDown(e, containerRef.current)}
      onMouseMove={(e) => containerRef.current && handlePointerMove(e, containerRef.current)}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={(e) => containerRef.current && handlePointerDown(e, containerRef.current)}
      onTouchMove={(e) => containerRef.current && handlePointerMove(e, containerRef.current)}
      onTouchEnd={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Ambient background */}
      <div className="meditative-backdrop" />

      {/*
        World Space Container

        This container holds both SVG and DOM elements in a unified coordinate system.
        - (0,0) is at the visual center of the viewport
        - Pan/zoom is applied via CSS transform to both layers uniformly
        - All positions are stored in world coordinates
      */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          // The transform origin is the center of this container
          transformOrigin: 'center center',
        }}
      >
        {/*
          Transformed World Layer
          Both SVG and DOM nodes live here with the same transform applied.
        */}
        <div
          className="relative pointer-events-auto"
          style={{
            transform: worldCoords.getWorldLayerTransform(),
            transformOrigin: 'center center',
          }}
        >
          {/* SVG layer reserved for future use (e.g., connection modes) */}
          <svg
            className="absolute pointer-events-none"
            style={{
              width: 2000,
              height: 2000,
              left: -1000,
              top: -1000,
            }}
            viewBox="-1000 -1000 2000 2000"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* No edges rendered - collections are scattered independently */}
          </svg>

          {/* DOM layer for nebulae and seed - centered at world origin */}
          <div
            className="absolute"
            style={{
              // This div is the origin point for all DOM elements
              // Elements position themselves relative to this (0,0) point
              left: 0,
              top: 0,
              width: 0,
              height: 0,
            }}
          >
            {/* Nebulae */}
            <AnimatePresence>
              {galaxy.nebulae.map((nebula) => (
                <motion.div
                  key={nebula.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    // Use framer-motion x/y so they combine with scale animation
                    x: nebula.position.x - nebula.radius,
                    y: nebula.position.y - nebula.radius,
                  }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                  }}
                >
                  <Nebula
                    nebula={nebula}
                    onClick={() => handleNebulaClick(nebula.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Seed at center (in capture mode) */}
            {mode === 'capture' && seed && (
              <Seed seed={seed} />
            )}

            {/* New nebula creation indicator */}
            <AnimatePresence>
              {isCreatingNebula && newNebulaPosition && (
                <motion.div
                  className="absolute"
                  style={{
                    left: 0,
                    top: 0,
                    transform: `translate(${newNebulaPosition.x - 40}px, ${newNebulaPosition.y - 40}px)`,
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                >
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center">
                    <span className="text-white/60 text-2xl">+</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Center indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-2 h-2 rounded-full bg-white/10" />
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 transition-colors"
          onClick={() => {
            onViewTransformChange?.({
              ...galaxy.viewTransform,
              scale: Math.min(galaxy.viewTransform.scale * 1.2, 3),
            })
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
          </svg>
        </button>
        <button
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 transition-colors"
          onClick={() => {
            onViewTransformChange?.({
              ...galaxy.viewTransform,
              scale: Math.max(galaxy.viewTransform.scale * 0.8, 0.5),
            })
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
          </svg>
        </button>
        <button
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 transition-colors"
          onClick={() => {
            onViewTransformChange?.({ x: 0, y: 0, scale: 1 })
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Instructions */}
      {mode === 'capture' && (
        <div className="absolute bottom-4 left-4 text-zen-text-muted text-sm font-data">
          <p>Tap a collection to place your item</p>
          <p className="text-xs mt-1 opacity-60">Long-press empty space to create new</p>
        </div>
      )}
    </div>
  )
}

export default GalaxyCanvas
