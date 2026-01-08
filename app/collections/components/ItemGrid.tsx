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
  onItemClick?: (item: ItemWithCollectionMetadata) => void
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded mb-3" />
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
    </div>
  )
}

export function ItemGrid({ items, isLoading, onItemClick }: ItemGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
        {[...Array(6)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          variant="grid"
          onClick={() => onItemClick?.(item)}
        />
      ))}
    </div>
  )
}
