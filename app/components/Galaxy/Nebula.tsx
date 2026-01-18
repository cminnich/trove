'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { type Nebula as NebulaType } from '@/types/meditative-capture'

interface NebulaProps {
  nebula: NebulaType
  onClick?: () => void
  /** Whether this nebula can receive the seed */
  canReceive?: boolean
}

/**
 * Nebula - A collection cluster in the Galaxy
 *
 * Features:
 * - Gradient fill based on collection type
 * - Orbiting sample items
 * - Glow on hover to indicate it's tappable
 * - Expansion animation when active
 */
export function Nebula({ nebula, onClick, canReceive = true }: NebulaProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [color1, color2] = nebula.themeColors
  const isHighlighted = nebula.isActive || isHovered

  return (
    <motion.div
      className="cursor-pointer"
      style={{
        // Size based on radius - positioning is handled by parent
        width: nebula.radius * 2,
        height: nebula.radius * 2,
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{
        scale: 1.08,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Gravitational field (visible when hovered or active) */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color1.replace('0.6', '0.3')} 0%, transparent 70%)`,
        }}
        animate={{
          scale: isHighlighted ? 1.4 : 1,
          opacity: isHighlighted ? 0.8 : 0.3,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Core nebula */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden border-2"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${color1} 0%, ${color2} 100%)`,
          borderColor: isHighlighted ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.15)',
        }}
        animate={{
          scale: isHighlighted ? 1.1 : 1,
          boxShadow: isHighlighted
            ? `0 0 25px ${color1}, 0 0 50px ${color2}`
            : `0 0 10px ${color1.replace('0.6', '0.3')}`,
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Inner glow */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2) 0%, transparent 50%)',
          }}
        />

        {/* Collection name */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-sm font-reflective text-white/90 text-center px-2"
            style={{
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
            }}
          >
            {nebula.name}
          </span>
        </div>

        {/* Item count badge */}
        {nebula.itemCount > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/40 rounded-full px-2 py-0.5">
            <span className="text-xs font-data text-white/80">
              {nebula.itemCount}
            </span>
          </div>
        )}
      </motion.div>

      {/* Orbiting sample items - up to 5 items, 72° apart */}
      {nebula.sampleItems.slice(0, 5).map((item, index) => (
        <OrbitingItem
          key={item.id}
          item={item}
          orbitRadius={nebula.radius + 15 + index * 10}
          orbitDuration={18 + index * 4}
          startAngle={(index * 72) % 360}
          isActive={nebula.isActive}
        />
      ))}

      {/* Themes */}
      {nebula.isActive && nebula.themes.length > 0 && (
        <motion.div
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {nebula.themes.slice(0, 3).map((theme, i) => (
            <span
              key={i}
              className="text-xs font-data text-zen-text-data/70 bg-zen-void/80 px-2 py-0.5 rounded"
            >
              {theme}
            </span>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}

/**
 * OrbitingItem - A sample item orbiting around a nebula
 */
interface OrbitingItemProps {
  item: {
    id: string
    title: string
    imageUrl?: string
  }
  orbitRadius: number
  orbitDuration: number
  startAngle: number
  isActive: boolean
}

function OrbitingItem({
  item,
  orbitRadius,
  orbitDuration,
  startAngle,
  isActive,
}: OrbitingItemProps) {
  const itemSize = 24

  return (
    <motion.div
      className="absolute rounded-full overflow-hidden border border-white/20"
      style={{
        width: itemSize,
        height: itemSize,
        left: '50%',
        top: '50%',
        marginLeft: -itemSize / 2,
        marginTop: -itemSize / 2,
        '--orbit-radius': `${orbitRadius}px`,
      } as React.CSSProperties}
      animate={isActive ? {
        // When active, items drift toward center
        x: Math.cos((startAngle * Math.PI) / 180) * (orbitRadius * 0.5),
        y: Math.sin((startAngle * Math.PI) / 180) * (orbitRadius * 0.5),
        scale: 1.2,
      } : {
        // Normal orbit
        x: Math.cos((startAngle * Math.PI) / 180) * orbitRadius,
        y: Math.sin((startAngle * Math.PI) / 180) * orbitRadius,
        scale: 1,
      }}
      transition={{
        duration: isActive ? 0.5 : orbitDuration,
        repeat: isActive ? 0 : Infinity,
        ease: isActive ? 'easeOut' : 'linear',
      }}
    >
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt={item.title}
          fill
          className="object-cover"
          sizes={`${itemSize}px`}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-800" />
      )}
    </motion.div>
  )
}

export default Nebula
