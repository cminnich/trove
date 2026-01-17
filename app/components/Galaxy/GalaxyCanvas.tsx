'use client'

import { useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Seed } from './Seed'
import { Nebula } from './Nebula'
import { GalaxyEdge } from './GalaxyEdge'
import { useGalaxyPhysics } from './useGalaxyPhysics'
import { useGalaxyGestures } from './useGalaxyGestures'
import {
  type GalaxyState,
  type SeedState,
  type Vec2,
  type Nebula as NebulaType,
} from '@/types/meditative-capture'

interface GalaxyCanvasProps {
  /** Galaxy state with nebulae and edges */
  galaxy: GalaxyState
  /** Seed state (only in capture mode) */
  seed?: SeedState
  /** Mode: capture (placing seed) or browse (exploring) */
  mode: 'capture' | 'browse'
  /** Called when seed position changes */
  onSeedPositionChange?: (position: Vec2) => void
  /** Called when seed drag starts */
  onSeedDragStart?: () => void
  /** Called when seed drag ends */
  onSeedDragEnd?: () => void
  /** Called when seed is placed into a nebula */
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
 * - Force-directed nebula positioning
 * - Pan/zoom navigation
 * - Seed dragging with magnetic attraction
 * - Long-press to create new nebula
 * - Edge rendering between related nebulae
 */
export function GalaxyCanvas({
  galaxy,
  seed,
  mode,
  onSeedPositionChange,
  onSeedDragStart,
  onSeedDragEnd,
  onSeedPlaced,
  onStartNebulaCreation,
  onNebulaeUpdate,
  onViewTransformChange,
  className = '',
}: GalaxyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCreatingNebula, setIsCreatingNebula] = useState(false)
  const [newNebulaPosition, setNewNebulaPosition] = useState<Vec2 | null>(null)

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
    onLongPress: (position) => {
      if (mode === 'capture') {
        setIsCreatingNebula(true)
        setNewNebulaPosition(position)
        onStartNebulaCreation?.(position)
      }
    },
  })

  // Handle seed placement
  const handleNebulaClick = useCallback((nebulaId: string) => {
    if (mode === 'capture' && seed) {
      onSeedPlaced?.(nebulaId)
    }
  }, [mode, seed, onSeedPlaced])

  // Handle seed drag
  const handleSeedDrag = useCallback((position: Vec2) => {
    onSeedPositionChange?.(position)
  }, [onSeedPositionChange])

  // Handle seed drag end - check if near a nebula
  const handleSeedDragEnd = useCallback(() => {
    onSeedDragEnd?.()

    if (galaxy.nearestNebula && seed) {
      const nearestNebula = galaxy.nebulae.find(n => n.id === galaxy.nearestNebula)
      if (nearestNebula) {
        const distance = Math.sqrt(
          Math.pow(seed.position.x - nearestNebula.position.x, 2) +
          Math.pow(seed.position.y - nearestNebula.position.y, 2)
        )

        // If within capture radius, place the seed
        if (distance < nearestNebula.radius * 1.5) {
          onSeedPlaced?.(nearestNebula.id)
        }
      }
    }
  }, [galaxy, seed, onSeedDragEnd, onSeedPlaced])

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

      {/* Galaxy content (transformed layer) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          x: galaxy.viewTransform.x,
          y: galaxy.viewTransform.y,
          scale: galaxy.viewTransform.scale,
        }}
      >
        {/* SVG layer for edges */}
        <svg
          className="absolute pointer-events-none"
          style={{
            width: '200%',
            height: '200%',
            left: '-50%',
            top: '-50%',
          }}
          viewBox="-500 -500 1000 1000"
        >
          {galaxy.edges.map((edge) => {
            const sourceNebula = galaxy.nebulae.find(n => n.id === edge.source)
            const targetNebula = galaxy.nebulae.find(n => n.id === edge.target)

            if (!sourceNebula || !targetNebula) return null

            return (
              <GalaxyEdge
                key={`${edge.source}-${edge.target}`}
                edge={edge}
                sourcePosition={sourceNebula.position}
                targetPosition={targetNebula.position}
              />
            )
          })}
        </svg>

        {/* Nebulae */}
        <AnimatePresence>
          {galaxy.nebulae.map((nebula) => (
            <motion.div
              key={nebula.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Nebula
                nebula={nebula}
                onClick={() => handleNebulaClick(nebula.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Seed (in capture mode) */}
        {mode === 'capture' && seed && (
          <Seed
            seed={seed}
            onDragStart={onSeedDragStart || (() => {})}
            onDrag={handleSeedDrag}
            onDragEnd={handleSeedDragEnd}
          />
        )}

        {/* New nebula creation indicator */}
        <AnimatePresence>
          {isCreatingNebula && newNebulaPosition && (
            <motion.div
              className="absolute"
              style={{
                left: newNebulaPosition.x - 40,
                top: newNebulaPosition.y - 40,
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
      </motion.div>

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
          <p>Drag the seed to a collection</p>
          <p className="text-xs mt-1 opacity-60">Long-press empty space to create new</p>
        </div>
      )}
    </div>
  )
}

export default GalaxyCanvas
