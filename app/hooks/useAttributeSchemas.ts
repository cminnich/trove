import useSWR from 'swr'
import type { Database } from '@/types/database'

type AttributeSchema = Database['public']['Tables']['attribute_schemas']['Row']

interface SchemasResponse {
  success: boolean
  data?: AttributeSchema[]
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useAttributeSchemas() {
  const { data, error, isLoading } = useSWR<SchemasResponse>(
    '/api/attributes/schemas',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes - schemas rarely change
    }
  )

  return {
    schemas: data?.data || [],
    isLoading: isLoading || (!error && !data),
    isError: error || (data && !data.success),
    error: data?.error || error,
  }
}
