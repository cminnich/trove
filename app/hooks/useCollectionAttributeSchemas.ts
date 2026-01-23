import { useCallback } from 'react'
import { useSWRConfig } from 'swr'

/**
 * Hook for managing collection attribute schema visibility
 * Used by ConnectionChips to toggle AI-discovered filter visibility
 */
export function useCollectionAttributeSchemas(collectionId: string | null) {
  const { mutate } = useSWRConfig()

  // Toggle a collection schema's visibility
  const toggleSchemaVisibility = useCallback(
    async (schemaId: string, isVisible: boolean) => {
      if (!collectionId) return

      try {
        const response = await fetch(`/api/collections/${collectionId}/attribute-schemas`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schema_id: schemaId,
            is_visible: isVisible,
          }),
        })

        if (response.ok) {
          // Revalidate item attributes to reflect visibility change
          mutate((key: string) =>
            typeof key === 'string' && key.includes('/api/items/') && key.includes('/attributes')
          )
        } else {
          console.error('Failed to toggle collection schema visibility')
        }
      } catch (err) {
        console.error('Error toggling collection schema visibility:', err)
      }
    },
    [collectionId, mutate]
  )

  return {
    toggleSchemaVisibility,
  }
}
