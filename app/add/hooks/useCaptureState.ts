import { useState, useEffect, useRef, useCallback } from 'react'
import type {
  CaptureState,
  ExtractionState,
  CaptureContext,
  SaveIntent,
  CreateItemRequest,
  ItemWithContext
} from '@/types/capture'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface UseCaptureStateOptions {
  initialUrl?: string
  onSuccess?: (item: Item, collections: string[]) => void
  onError?: (error: string) => void
}

interface UseCaptureStateReturn {
  state: CaptureState
  context: CaptureContext
  saveIntent: SaveIntent
  updateContext: (updates: Partial<CaptureContext>) => void
  triggerSave: () => void
  reset: () => void
  retry: () => void
}

/**
 * Core state management for Context-First Capture flow.
 *
 * Handles:
 * - State machine transitions
 * - Race condition coordination via saveIntent
 * - Background extraction + foreground context input
 * - Auto-save when both user and extraction are ready
 */
export function useCaptureState({
  initialUrl,
  onSuccess,
  onError
}: UseCaptureStateOptions = {}): UseCaptureStateReturn {
  // Main state machine
  const [state, setState] = useState<CaptureState>(
    initialUrl
      ? { stage: 'initializing', url: initialUrl }
      : { stage: 'error', error: 'No URL provided', canRetry: false }
  )

  // User context (notes + collections)
  const [context, setContext] = useState<CaptureContext>({
    notes: '',
    selectedCollections: [],
    isDirty: false
  })

  // Save intent tracking (for race conditions)
  const [saveIntent, setSaveIntent] = useState<SaveIntent>({ type: 'none' })

  // Refs for cleanup and avoiding stale closures
  const extractionPromiseRef = useRef<Promise<ItemWithContext> | null>(null)
  const isMountedRef = useRef(true)

  // Initialize: Start extraction when URL is provided
  useEffect(() => {
    if (state.stage === 'initializing') {
      startCapture(state.url)
    }
  }, [state.stage])

  // Race condition handler: Auto-save when extraction completes if user already clicked save
  useEffect(() => {
    if (
      state.stage === 'capturing' &&
      state.extraction.status === 'complete' &&
      saveIntent.type === 'pending'
    ) {
      // Extraction just completed and user was waiting → execute save
      executeSave(state.extraction.item, saveIntent.context)
    }
  }, [state, saveIntent])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /**
   * Start the capture flow: transition to 'capturing' and begin extraction
   */
  const startCapture = useCallback((url: string) => {
    setState({
      stage: 'capturing',
      url,
      extraction: { status: 'pending' }
    })

    // Transition to in_progress and start extraction
    setTimeout(() => {
      if (!isMountedRef.current) return

      setState(prev =>
        prev.stage === 'capturing'
          ? { ...prev, extraction: { status: 'in_progress', progress: 0 } }
          : prev
      )

      // Trigger actual extraction API call
      startExtraction(url)
    }, 100)
  }, [])

  /**
   * Start background extraction API call
   */
  const startExtraction = useCallback(async (url: string) => {
    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      const data = await response.json()

      if (!isMountedRef.current) return

      if (!response.ok) {
        setState(prev =>
          prev.stage === 'capturing'
            ? {
                ...prev,
                extraction: {
                  status: 'failed',
                  error: data.error || 'Extraction failed'
                }
              }
            : prev
        )
        return
      }

      // Extraction successful
      const item: Item = data.data?.item || data.data
      const needsReview = (item.confidence_score ?? 1) < 0.7

      setState(prev =>
        prev.stage === 'capturing'
          ? {
              ...prev,
              extraction: {
                status: 'complete',
                item,
                needsReview
              }
            }
          : prev
      )

      // Update saveIntent to 'ready' if user hasn't clicked save yet
      setSaveIntent(prev =>
        prev.type === 'none' ? { type: 'ready', context } : prev
      )
    } catch (error) {
      if (!isMountedRef.current) return

      setState(prev =>
        prev.stage === 'capturing'
          ? {
              ...prev,
              extraction: {
                status: 'failed',
                error: 'Network error. Please try again.'
              }
            }
          : prev
      )
    }
  }, [context])

  /**
   * Update user context (notes or selected collections)
   */
  const updateContext = useCallback((updates: Partial<CaptureContext>) => {
    setContext(prev => ({
      ...prev,
      ...updates,
      isDirty: true
    }))
  }, [])

  /**
   * User clicks "Save" button
   *
   * Race condition handling:
   * - If extraction complete: Save immediately
   * - If extraction pending: Set saveIntent='pending', wait for extraction
   */
  const triggerSave = useCallback(() => {
    if (state.stage !== 'capturing') return

    // Validation: Require notes OR collections
    if (context.notes.trim().length === 0 && context.selectedCollections.length === 0) {
      onError?.('Please add context or select a collection')
      return
    }

    // Case 1: Extraction already complete → save immediately
    if (state.extraction.status === 'complete') {
      executeSave(state.extraction.item, context)
      return
    }

    // Case 2: Extraction still running → set saveIntent to 'pending'
    if (state.extraction.status === 'in_progress' || state.extraction.status === 'pending') {
      setSaveIntent({ type: 'pending', context })
      // Note: Save will auto-trigger when extraction completes (handled in useEffect)
      return
    }

    // Case 3: Extraction failed → show error
    if (state.extraction.status === 'failed') {
      onError?.('Extraction failed. Please retry.')
      return
    }
  }, [state, context, onError])

  /**
   * Execute the final save operation
   *
   * Note: Item was already created during extraction.
   * Now we just need to assign it to collections with notes.
   */
  const executeSave = useCallback(async (item: Item, saveContext: CaptureContext) => {
    setState(prev =>
      prev.stage === 'capturing'
        ? { stage: 'saving', url: prev.url, item, context: saveContext }
        : prev
    )

    try {
      // Item was already created during extraction
      // Now assign to collections if any are selected
      if (saveContext.selectedCollections.length > 0) {
        // Use collection assignment API for each collection
        const collectionRequests = saveContext.selectedCollections.map(async (collectionId) => {
          const response = await fetch(`/api/collections/${collectionId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item_id: item.id,
              notes: saveContext.notes // Same notes for all collections
            })
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to assign to collection')
          }

          return response.json()
        })

        await Promise.all(collectionRequests)
      }

      if (!isMountedRef.current) return

      setState({
        stage: 'complete',
        item,
        collections: saveContext.selectedCollections
      })

      onSuccess?.(item, saveContext.selectedCollections)
    } catch (error) {
      if (!isMountedRef.current) return

      console.error('Error in executeSave:', error)

      setState({
        stage: 'error',
        error: error instanceof Error ? error.message : 'Failed to save item. Please try again.',
        canRetry: true
      })

      onError?.(error instanceof Error ? error.message : 'Failed to save item')
    }
  }, [onSuccess, onError])

  /**
   * Reset to initial state (for "Add Another" action)
   */
  const reset = useCallback(() => {
    setContext({
      notes: '',
      selectedCollections: [],
      isDirty: false
    })
    setSaveIntent({ type: 'none' })

    if (initialUrl) {
      setState({ stage: 'initializing', url: initialUrl })
    } else {
      setState({ stage: 'error', error: 'No URL provided', canRetry: false })
    }
  }, [initialUrl])

  /**
   * Retry extraction after failure
   */
  const retry = useCallback(() => {
    if (state.stage === 'capturing' && state.extraction.status === 'failed') {
      startCapture(state.url)
    } else if (state.stage === 'error' && state.canRetry && initialUrl) {
      startCapture(initialUrl)
    }
  }, [state, initialUrl, startCapture])

  return {
    state,
    context,
    saveIntent,
    updateContext,
    triggerSave,
    reset,
    retry
  }
}
