import useSWR from 'swr'
import { useCallback } from 'react'
import type { Database } from '@/types/database'

type FilterPreference = Database['public']['Tables']['collection_filter_preferences']['Row']
type AttributeSchema = Database['public']['Tables']['attribute_schemas']['Row']

interface FilterPreferenceWithSchema extends FilterPreference {
  schema: AttributeSchema
}

interface FilterPreferencesResponse {
  success: boolean
  data?: FilterPreferenceWithSchema[]
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useFilterPreferences(collectionId: string | null, isReadOnly: boolean = false) {
  const url = collectionId ? `/api/collections/${collectionId}/filter-preferences` : null

  const { data, error, mutate, isLoading } = useSWR<FilterPreferencesResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  )

  // Toggle a filter's hidden state
  const toggleFilter = useCallback(
    async (schemaId: string, isHidden: boolean, forceShow: boolean) => {
      if (!collectionId) return

      // Read-only mode: don't save changes to database
      if (isReadOnly) return

      try {
        const response = await fetch(`/api/collections/${collectionId}/filter-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schema_id: schemaId,
            is_hidden: isHidden,
            force_show: forceShow,
          }),
        })

        if (response.ok) {
          mutate()
        }
      } catch (err) {
        console.error('Failed to update filter preference:', err)
      }
    },
    [collectionId, isReadOnly, mutate]
  )

  // Delete a filter preference (reset to auto-hide behavior)
  const resetFilter = useCallback(
    async (schemaId: string) => {
      if (!collectionId) return

      // Read-only mode: don't save changes to database
      if (isReadOnly) return

      try {
        const response = await fetch(
          `/api/collections/${collectionId}/filter-preferences?schema_id=${schemaId}`,
          { method: 'DELETE' }
        )

        if (response.ok) {
          mutate()
        }
      } catch (err) {
        console.error('Failed to reset filter preference:', err)
      }
    },
    [collectionId, isReadOnly, mutate]
  )

  // Build a map of schema_id -> preference for easy lookup
  const preferencesMap = new Map<string, FilterPreferenceWithSchema>()
  if (data?.data) {
    for (const pref of data.data) {
      preferencesMap.set(pref.schema_id, pref)
    }
  }

  return {
    preferences: data?.data || [],
    preferencesMap,
    isLoading: isLoading || (!error && !data && !!collectionId),
    isError: error || (data && !data.success),
    error: data?.error || error,
    toggleFilter,
    resetFilter,
    mutate,
  }
}
