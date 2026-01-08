'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableItemCard } from './SortableItemCard'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface SortableItemGridProps {
  items: ItemWithCollectionMetadata[]
  isLoading?: boolean
  editMode: boolean
  onItemClick?: (item: ItemWithCollectionMetadata) => void
  onReorder: (itemPositions: Array<{ item_id: string; position: number }>) => void
}

export function SortableItemGrid({
  items,
  isLoading,
  editMode,
  onItemClick,
  onReorder,
}: SortableItemGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // Configure sensors for long-press activation
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 500, // 500ms long-press
        tolerance: 10, // 10px movement tolerance
      },
    })
  )

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Reorder locally
    const reorderedItems = arrayMove(items, oldIndex, newIndex)

    // Calculate new positions
    const itemPositions = reorderedItems.map((item, index) => ({
      item_id: item.id,
      position: index,
    }))

    // Send to parent for server update
    onReorder(itemPositions)
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
          >
            <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded mb-3" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
          {items.map((item) => (
            <SortableItemCard
              key={item.id}
              item={item}
              editMode={editMode}
              isDragging={activeId === item.id}
              onClick={() => !editMode && onItemClick?.(item)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
