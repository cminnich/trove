import useSWR from 'swr'
import type { Database } from '@/types/database'

type Collection = Database['public']['Tables']['collections']['Row']

/** Collection as returned by GET /api/collections (includes shared-with-edit) */
export interface CollectionWithThumbnails extends Collection {
  item_count: number
  thumbnail_urls: string[]
  /** 'owner' = owned by current user, 'editor' = shared with user with edit access */
  access_type?: 'owner' | 'editor'
}

interface CollectionsResponse {
  success: boolean
  data?: CollectionWithThumbnails[]
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useCollections() {
  const { data, error, mutate, isLoading } = useSWR<CollectionsResponse>(
    '/api/collections',
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  return {
    collections: data?.data || [],
    isLoading: isLoading || (!error && !data),
    isError: error || (data && !data.success),
    error: data?.error || error,
    mutate,
  }
}
