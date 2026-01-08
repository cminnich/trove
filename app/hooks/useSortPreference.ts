'use client'

import { useState, useEffect } from 'react'
import type { SortOption } from './useCollectionItems'

export function useSortPreference(collectionId: string): [SortOption, (sort: SortOption) => void] {
  const key = `trove:collection:${collectionId}:sortOrder`
  const [sortOrder, setSortOrderState] = useState<SortOption>('position')

  useEffect(() => {
    // Read from localStorage on mount
    const stored = localStorage.getItem(key)
    if (stored === 'position' || stored === 'recent' || stored === 'price_asc' || stored === 'price_desc' || stored === 'category') {
      setSortOrderState(stored)
    }
  }, [key])

  const setSortOrder = (sort: SortOption) => {
    setSortOrderState(sort)
    localStorage.setItem(key, sort)
  }

  return [sortOrder, setSortOrder]
}
