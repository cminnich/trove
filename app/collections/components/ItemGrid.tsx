import { ItemCard } from './ItemCard'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface ItemGridProps {
  items: ItemWithCollectionMetadata[]
  isLoading?: boolean
  onItemClick?: (item: ItemWithCollectionMetadata, index: number) => void
  layout?: 'grid' | 'masonry'
  cardVariant?: 'grid' | 'spec-sheet'
}

function SkeletonCard() {
  return (
    <div className="bg-slate-deep rounded-lg border border-slate-800 p-4 animate-pulse">
      <div className="w-full aspect-square bg-slate-800 rounded mb-3" />
      <div className="h-5 bg-slate-800 rounded w-3/4 mb-2" />
      <div className="h-4 bg-slate-800 rounded w-1/2 mb-2" />
      <div className="h-6 bg-slate-800 rounded w-2/3" />
    </div>
  )
}

function SkeletonCardSpecSheet() {
  return (
    <div className="bg-void border border-slate-800 rounded-md shadow-hard overflow-hidden animate-pulse break-inside-avoid mb-4">
      <div className="w-full aspect-square bg-slate-800" />
      <div className="border-t border-slate-800 p-3">
        <div className="h-4 bg-slate-800 rounded w-3/4 mb-2" />
        <div className="h-3 bg-slate-800 rounded w-1/2" />
      </div>
      <div className="border-t border-slate-800 p-3 space-y-2">
        <div className="h-3 bg-slate-800 rounded w-full" />
        <div className="h-3 bg-slate-800 rounded w-full" />
        <div className="h-3 bg-slate-800 rounded w-2/3" />
      </div>
    </div>
  )
}

export function ItemGrid({ items, isLoading, onItemClick, layout = 'grid', cardVariant = 'grid' }: ItemGridProps) {
  if (isLoading) {
    if (layout === 'masonry') {
      return (
        <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4">
          {[...Array(8)].map((_, i) => (
            <SkeletonCardSpecSheet key={i} />
          ))}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
        {[...Array(6)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  // Masonry layout using CSS columns
  if (layout === 'masonry') {
    return (
      <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4">
        {items.map((item, index) => (
          <div key={item.id} className="break-inside-avoid mb-4">
            <ItemCard
              item={item}
              variant={cardVariant}
              onClick={() => onItemClick?.(item, index)}
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          variant={cardVariant}
          onClick={() => onItemClick?.(item, index)}
        />
      ))}
    </div>
  )
}
