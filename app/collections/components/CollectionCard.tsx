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
      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
      aria-label={`${name}, ${item_count} ${item_count === 1 ? 'item' : 'items'}`}
    >
      {/* 2×2 Thumbnail Grid */}
      <div className="aspect-square grid grid-cols-2 gap-1 p-2">
        {thumbnails.slice(0, 4).map((url, index) => (
          <div
            key={index}
            className="bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center"
          >
            {url ? (
              <img
                src={url}
                alt=""
                className="w-full h-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="text-4xl text-gray-300 dark:text-gray-600">📦</div>
            )}
          </div>
        ))}
      </div>

      {/* Collection Info */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate">
          {name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {item_count} {item_count === 1 ? 'item' : 'items'}
        </p>
      </div>
    </Link>
  )
}
