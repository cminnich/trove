'use client'

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
 * - Magnetic glow when seed approaches
 * - Expansion animation when active
 */
export function Nebula({ nebula, onClick, canReceive = true }: NebulaProps) {
  const [color1, color2] = nebula.themeColors

  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        width: nebula.radius * 2,
        height: nebula.radius * 2,
        left: nebula.position.x - nebula.radius,
        top: nebula.position.y - nebula.radius,
      }}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Gravitational field (visible when active) */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color1.replace('0.6', '0.2')} 0%, transparent 70%)`,
        }}
        animate={{
          scale: nebula.isActive ? nebula.gravitationalPull * 1.5 : 1,
          opacity: nebula.isActive ? 0.8 : 0.3,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Core nebula */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${color1} 0%, ${color2} 100%)`,
          border: `2px solid ${nebula.isActive ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)'}`,
        }}
        animate={{
          scale: nebula.isActive ? 1.15 : 1,
          boxShadow: nebula.isActive
            ? `0 0 30px ${color1}, 0 0 60px ${color2}`
            : `0 0 10px ${color1.replace('0.6', '0.3')}`,
        }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
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

      {/* Orbiting sample items */}
      {nebula.sampleItems.slice(0, 3).map((item, index) => (
        <OrbitingItem
          key={item.id}
          item={item}
          orbitRadius={nebula.radius + 20 + index * 15}
          orbitDuration={20 + index * 5}
          startAngle={(index * 120) % 360}
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
