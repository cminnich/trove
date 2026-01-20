import useSWR from 'swr'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface ItemWithCollectionMetadata extends Item {
  added_at: string
  position: number | null
  notes: string | null
}

interface FilteredItemsResponse {
  success: boolean
  data?: {
    items: ItemWithCollectionMetadata[]
    total: number
    group_key: string
  }
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useFilteredCollectionItems(
  collectionId: string | null,
  groupKey: string | null
) {
  const url =
    collectionId && groupKey
      ? `/api/collections/${collectionId}/items/by-attribute?group_key=${encodeURIComponent(groupKey)}`
      : null

  const { data, error, mutate, isLoading } = useSWR<FilteredItemsResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000, // 10 seconds
    }
  )

  return {
    items: data?.data?.items || [],
    total: data?.data?.total || 0,
    groupKey: data?.data?.group_key || null,
    isLoading: isLoading || (!error && !data && !!collectionId && !!groupKey),
    isError: error || (data && !data.success),
    error: data?.error || error,
    mutate,
  }
}
