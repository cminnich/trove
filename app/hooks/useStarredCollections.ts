import useSWR from 'swr'

interface StarredCollection {
  id: string
  name: string
  description: string | null
  type: string | null
  visibility: string
  fork_count: number
  star_count: number
  is_forkable: boolean
  created_at: string
  starred_at: string
  owner_id: string
  owner_username: string
  item_count: number
  thumbnail_urls: string[]
}

interface StarredCollectionsResponse {
  success: boolean
  data?: StarredCollection[]
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useStarredCollections() {
  const { data, error, mutate, isLoading } = useSWR<StarredCollectionsResponse>(
    '/api/user/starred',
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
