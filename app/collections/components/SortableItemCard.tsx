import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { ConfidenceBadge } from '@/app/components/ConfidenceBadge'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface SortableItemCardProps {
  item: ItemWithCollectionMetadata
  editMode: boolean
  isDragging: boolean
  onClick?: () => void
}

export function SortableItemCard({ item, editMode, isDragging, onClick }: SortableItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  }

  const needsReview = item.confidence_score !== null && item.confidence_score < 0.7

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Drag Handle - only visible in edit mode */}
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 z-10 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg cursor-grab active:cursor-grabbing hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
      )}

      {/* Item Card */}
      <button
        onClick={onClick}
        disabled={editMode}
        className={`w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left transition-all ${
          editMode
            ? 'cursor-default'
            : 'hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer'
        } ${isDragging ? 'scale-105 shadow-xl' : ''}`}
      >
        {/* Confidence Badge */}
        {needsReview && (
          <div className="mb-3">
            <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded">
              ⚠️ Review
            </span>
          </div>
        )}

        {/* Image */}
        <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center mb-3">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="text-6xl text-gray-300 dark:text-gray-600">📦</div>
          )}
        </div>

        {/* Details */}
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
          {item.title}
        </h3>

        {item.brand && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{item.brand}</p>
        )}

        {item.price && item.currency && (
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 font-mono mb-2">
            {item.currency === 'USD' && '$'}
            {item.price.toLocaleString()}
            {item.currency !== 'USD' && ` ${item.currency}`}
          </p>
        )}

        {item.item_type && (
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {item.item_type}
          </p>
        )}
      </button>
    </div>
  )
}
