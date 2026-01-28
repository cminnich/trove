import Link from 'next/link'
import { GitFork } from 'lucide-react'

interface PublicCollectionCardProps {
  collection: {
    id: string
    name: string
    owner_username: string
    item_count: number
    fork_count: number
    thumbnail_urls: string[]
  }
}

export function PublicCollectionCard({ collection }: PublicCollectionCardProps) {
  const { id, name, owner_username, item_count, fork_count, thumbnail_urls } = collection

  // Fill missing thumbnails with placeholders
  const thumbnails = [...thumbnail_urls]
  while (thumbnails.length < 4) {
    thumbnails.push('')
  }

  return (
    <Link
      href={`/collections/${id}`}
      className="block bg-slate-deep rounded-lg border border-slate-800 hover:border-open-green transition-colors shadow-hard"
      aria-label={`${name} by ${owner_username}, ${item_count} ${item_count === 1 ? 'item' : 'items'}`}
    >
      {/* 2×2 Thumbnail Grid */}
      <div className="aspect-square grid grid-cols-2 gap-1 p-2">
        {thumbnails.slice(0, 4).map((url, index) => (
          <div
            key={index}
            className="bg-slate-800 rounded overflow-hidden flex items-center justify-center"
          >
            {url ? (
              <img
                src={url}
                alt=""
                className="w-full h-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="text-4xl text-slate-600">📦</div>
            )}
          </div>
        ))}
      </div>

      {/* Collection Info */}
      <div className="p-4 border-t border-slate-800">
        <h3 className="font-mono font-semibold text-white mb-1 truncate">
          {name}
        </h3>
        <p className="text-xs font-mono text-slate-400 mb-2">
          {item_count} {item_count === 1 ? 'item' : 'items'}
        </p>

        {/* Attribution & Fork Count */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span className="text-open-green">@{owner_username}</span>
          {fork_count > 0 && (
            <>
              <span>•</span>
              <div className="flex items-center gap-1">
                <GitFork className="w-3 h-3" />
                <span>{fork_count}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
