import Link from 'next/link'
import type { Database } from '@/types/database'

type Collection = Database['public']['Tables']['collections']['Row']

interface CollectionCardProps {
  collection: Collection & {
    thumbnail_urls: string[]
    item_count: number
  }
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const { id, name, item_count, thumbnail_urls } = collection

  // Fill missing thumbnails with placeholders
  const thumbnails = [...thumbnail_urls]
  while (thumbnails.length < 4) {
    thumbnails.push('')
  }

  return (
    <Link
      href={`/collections/${id}`}
      className="block bg-slate-deep rounded-lg border border-slate-800 hover:border-open-green transition-colors shadow-hard"
      aria-label={`${name}, ${item_count} ${item_count === 1 ? 'item' : 'items'}`}
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
        <p className="text-sm font-mono text-slate-400">
          {item_count} {item_count === 1 ? 'item' : 'items'}
        </p>
      </div>
    </Link>
  )
}
