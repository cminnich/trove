import { CollectionCard } from './CollectionCard'
import type { Database } from '@/types/database'

type Collection = Database['public']['Tables']['collections']['Row']

interface CollectionGridProps {
  collections: (Collection & {
    thumbnail_urls: string[]
    item_count: number
  })[]
  isLoading?: boolean
}

function SkeletonCard() {
  return (
    <div className="bg-slate-deep rounded-lg border border-slate-800 animate-pulse shadow-hard">
      {/* Skeleton thumbnail grid */}
      <div className="aspect-square grid grid-cols-2 gap-1 p-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-slate-800 rounded" />
        ))}
      </div>
      {/* Skeleton info */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <div className="h-5 bg-slate-800 rounded w-3/4" />
        <div className="h-4 bg-slate-800 rounded w-1/2" />
      </div>
    </div>
  )
}

export function CollectionGrid({ collections, isLoading }: CollectionGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
        {[...Array(6)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
      {collections.map((collection) => (
        <CollectionCard key={collection.id} collection={collection} />
      ))}
    </div>
  )
}
