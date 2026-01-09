import useSWR from 'swr'
import type { Database } from '@/types/database'

type Collection = Database['public']['Tables']['collections']['Row']

export interface UserCollectionWithMetadata extends Collection {
  notes: string | null
  position: number | null
}

interface UserCollectionsResponse {
  success: boolean
  data?: UserCollectionWithMetadata[]
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useUserCollections(itemId: string | null) {
  const { data, error, mutate, isLoading } = useSWR<UserCollectionsResponse>(
    itemId ? `/api/items/${itemId}/user-collections` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  return {
    userCollections: data?.data || [],
    isLoading: isLoading || (!error && !data),
    isError: error || (data && !data.success),
    error: data?.error || error,
    mutate,
  }
}
