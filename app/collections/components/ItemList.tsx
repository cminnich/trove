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
  onItemClick?: (item: ItemWithCollectionMetadata, index: number) => void
}

function SkeletonRow() {
  return (
    <div className="bg-slate-deep rounded-lg border border-slate-800 p-4 animate-pulse">
      <div className="flex gap-4">
        <div className="flex-shrink-0 w-16 h-16 bg-slate-800 rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-slate-800 rounded w-3/4" />
          <div className="h-4 bg-slate-800 rounded w-1/2" />
          <div className="h-6 bg-slate-800 rounded w-2/3" />
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
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          variant="list"
          onClick={() => onItemClick?.(item, index)}
        />
      ))}
    </div>
  )
}
