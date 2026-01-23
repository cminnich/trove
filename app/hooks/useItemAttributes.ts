import useSWR from 'swr'
import type { Database } from '@/types/database'

type ItemAttribute = Database['public']['Tables']['item_attributes']['Row']

// Unified schema interface that works for both global and collection schemas
// This matches the API response format from /api/items/[id]/attributes
interface UnifiedSchema {
  id: string
  name: string
  display_name: string
  description: string | null
  display_order: number
  is_collection_schema: boolean
  is_visible?: boolean
}

interface AttributeWithSchema extends ItemAttribute {
  schema: UnifiedSchema
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
