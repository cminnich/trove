import useSWR from 'swr'
import type { Database } from '@/types/database'

type Collection = Database['public']['Tables']['collections']['Row']

interface CollectionWithThumbnails extends Collection {
  item_count: number
  thumbnail_urls: string[]
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
