'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'trove:galaxyViewEnabled'
const EVENT_NAME = 'trove:galaxyViewChanged'

/**
 * Hook to check and manage the Galaxy View preference
 *
 * Usage:
 * ```tsx
 * const { isGalaxyView, toggle, setGalaxyView } = useGalaxyViewPreference()
 *
 * // Check mode
 * if (isGalaxyView) {
 *   return <GalaxyCanvas />
 * } else {
 *   return <LedgerView />
 * }
 *
 * // Toggle mode
 * <button onClick={toggle}>Switch View</button>
 * ```
 */
export function useGalaxyViewPreference() {
  const [isGalaxyView, setIsGalaxyView] = useState(true) // Default to Galaxy view
  const [isLoaded, setIsLoaded] = useState(false)

  // Load initial value from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) {
        setIsGalaxyView(stored === 'true')
      }
      setIsLoaded(true)
    }
  }, [])

  // Listen for changes from other components
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleChange = (event: CustomEvent<boolean>) => {
      setIsGalaxyView(event.detail)
    }

    window.addEventListener(EVENT_NAME, handleChange as EventListener)
    return () => {
      window.removeEventListener(EVENT_NAME, handleChange as EventListener)
    }
  }, [])

  const setGalaxyView = useCallback((enabled: boolean) => {
    setIsGalaxyView(enabled)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(enabled))
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: enabled }))
    }
  }, [])

  const toggle = useCallback(() => {
    setGalaxyView(!isGalaxyView)
  }, [isGalaxyView, setGalaxyView])

  return {
    /** Whether Galaxy View is enabled (true) or Ledger View (false) */
    isGalaxyView,
    /** Whether the preference has been loaded from storage */
    isLoaded,
    /** Toggle between Galaxy and Ledger views */
    toggle,
    /** Set the view mode explicitly */
    setGalaxyView,
  }
}

/**
 * Check if Galaxy View is enabled (for non-hook contexts)
 * Returns true if Galaxy View is enabled, false for Ledger View
 */
export function getGalaxyViewPreference(): boolean {
  if (typeof window === 'undefined') return true // Default to Galaxy on server
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored !== 'false' // Default to true if not set
}

export default useGalaxyViewPreference
