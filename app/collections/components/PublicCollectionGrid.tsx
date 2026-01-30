import { PublicCollectionCard } from './PublicCollectionCard'

interface PublicCollection {
  id: string
  name: string
  owner_username: string
  item_count: number
  fork_count: number
  star_count: number
  thumbnail_urls: string[]
}

interface PublicCollectionGridProps {
  collections: PublicCollection[]
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
        <div className="h-3 bg-slate-800 rounded w-2/3" />
      </div>
    </div>
  )
}

export function PublicCollectionGrid({ collections, isLoading }: PublicCollectionGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
        {[...Array(6)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="mb-4 text-6xl opacity-30">📦</div>
        <p className="font-mono text-lg text-slate-400 mb-2">
          No public collections yet
        </p>
        <p className="font-mono text-sm text-slate-600">
          Be the first to make yours public!
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
      {collections.map((collection) => (
        <PublicCollectionCard key={collection.id} collection={collection} />
      ))}
    </div>
  )
}
