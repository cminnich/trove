import { ItemCard } from './ItemCard'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface ItemListProps {
  items: ItemWithCollectionMetadata[]
  isLoading?: boolean
  onItemClick?: (item: ItemWithCollectionMetadata) => void
}

function SkeletonRow() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="flex gap-4">
        <div className="flex-shrink-0 w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        </div>
      </div>
    </div>
  )
}

export function ItemList({ items, isLoading, onItemClick }: ItemListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          variant="list"
          onClick={() => onItemClick?.(item)}
        />
      ))}
    </div>
  )
}
