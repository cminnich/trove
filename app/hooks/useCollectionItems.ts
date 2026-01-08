import useSWR from 'swr'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface CollectionItemsResponse {
  success: boolean
  data?: ItemWithCollectionMetadata[]
  error?: string
}

export type SortOption = 'position' | 'recent' | 'price_asc' | 'price_desc' | 'category'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useCollectionItems(collectionId: string, sortBy: SortOption = 'position') {
  const { data, error, mutate, isLoading } = useSWR<CollectionItemsResponse>(
    `/api/collections/${collectionId}/items?sort=${sortBy}`,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  const reorder = async (itemPositions: Array<{ item_id: string; position: number }>) => {
    // Optimistic update
    const previousData = data

    if (data?.data) {
      const updatedItems = [...data.data]
      // Update positions locally
      itemPositions.forEach(({ item_id, position }) => {
        const item = updatedItems.find(i => i.id === item_id)
        if (item) {
          item.position = position
        }
      })

      // Sort by new positions
      updatedItems.sort((a, b) => {
        if (a.position === null) return 1
        if (b.position === null) return -1
        return a.position - b.position
      })

      // Update cache optimistically
      mutate({ ...data, data: updatedItems }, false)
    }

    try {
      // Send to server
      const response = await fetch(`/api/collections/${collectionId}/items/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemPositions }),
      })

      if (!response.ok) {
        throw new Error('Failed to reorder items')
      }

      // Revalidate
      mutate()
    } catch (error) {
      // Revert on error
      mutate(previousData, false)
      throw error
    }
  }

  return {
    items: data?.data || [],
    isLoading: isLoading || (!error && !data),
    isError: error || (data && !data.success),
    error: data?.error || error,
    reorder,
    mutate,
  }
}
