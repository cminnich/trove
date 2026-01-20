import useSWR from 'swr'
import type { Database } from '@/types/database'

type ItemAttribute = Database['public']['Tables']['item_attributes']['Row']
type AttributeSchema = Database['public']['Tables']['attribute_schemas']['Row']

interface AttributeWithSchema extends ItemAttribute {
  schema: AttributeSchema
}

interface AttributeWithCount {
  attribute: AttributeWithSchema
  related_count: number
}

interface ItemAttributesResponse {
  success: boolean
  data?: AttributeWithCount[]
  total_collection_items?: number
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useItemAttributes(itemId: string | null, collectionId?: string | null) {
  const url = itemId
    ? collectionId
      ? `/api/items/${itemId}/attributes?collection_id=${collectionId}`
      : `/api/items/${itemId}/attributes`
    : null

  const { data, error, mutate, isLoading } = useSWR<ItemAttributesResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  )

  return {
    attributes: data?.data || [],
    totalCollectionItems: data?.total_collection_items,
    isLoading: isLoading || (!error && !data && !!itemId),
    isError: error || (data && !data.success),
    error: data?.error || error,
    mutate,
  }
}
