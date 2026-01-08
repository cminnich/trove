'use client'

import { useState, useEffect } from 'react'

export type ViewMode = 'grid' | 'list'

export function useViewPreference(collectionId: string): [ViewMode, (mode: ViewMode) => void] {
  const key = `trove:collection:${collectionId}:viewMode`
  const [viewMode, setViewModeState] = useState<ViewMode>('grid')

  useEffect(() => {
    // Read from localStorage on mount
    const stored = localStorage.getItem(key)
    if (stored === 'grid' || stored === 'list') {
      setViewModeState(stored)
    }
  }, [key])

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode)
    localStorage.setItem(key, mode)
  }

  return [viewMode, setViewMode]
}
