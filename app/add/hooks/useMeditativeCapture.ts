'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  type MeditativeCaptureState,
  type SeedState,
  type GalaxyState,
  type DialogueState,
  type PlacementResult,
  type StructuredNotes,
  type Nebula,
  type SocraticQuestion,
  type ExtractionStatus,
  type Vec2,
  vec2,
} from '@/types/meditative-capture'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']
type Collection = Database['public']['Tables']['collections']['Row']

// =============================================================================
// Hook Options & Return Types
// =============================================================================

interface UseMeditativeCaptureOptions {
  /** Initial URL to capture */
  initialUrl?: string
  /** Available collections for building the galaxy */
  collections?: Collection[]
  /** Items for each collection (keyed by collection ID) - for orbiting display */
  collectionItems?: Map<string, Item[]>
  /** Callback when capture is complete */
  onComplete?: (item: Item, collection: Collection, notes: StructuredNotes) => void
  /** Callback on error */
  onError?: (error: string) => void
  /** Callback when user departs early */
  onDepart?: (itemId: string) => void
}

interface UseMeditativeCaptureReturn {
  /** Current state of the capture flow */
  state: MeditativeCaptureState
  /** Update seed position (during drag) */
  updateSeedPosition: (position: Vec2) => void
  /** Start dragging the seed */
  startDragging: () => void
  /** Stop dragging the seed */
  stopDragging: () => void
  /** Place the seed into a nebula (collection) */
  placeSeed: (collectionId: string) => Promise<void>
  /** Start long-press to create new nebula */
  startLongPress: (position: Vec2) => void
  /** Cancel long-press */
  cancelLongPress: () => void
  /** Complete long-press to create new nebula */
  createNebula: (name: string) => Promise<void>
  /** Submit answer to current question */
  submitAnswer: (answer: string) => void
  /** Skip current question */
  skipQuestion: () => void
  /** Complete the inquiry phase */
  completeInquiry: () => Promise<void>
  /** User departs early (item goes to inbox) */
  depart: () => void
  /** Update galaxy view transform */
  updateViewTransform: (transform: { x: number; y: number; scale: number }) => void
  /** Retry after error */
  retry: () => void
  /** Reset for new capture */
  reset: () => void
}

// =============================================================================
// Theme colors for nebulae
// =============================================================================

const NEBULA_COLORS: Record<string, [string, string]> = {
  inbox: ['rgba(99, 102, 241, 0.6)', 'rgba(139, 92, 246, 0.6)'],
  wishlist: ['rgba(245, 158, 11, 0.6)', 'rgba(249, 115, 22, 0.6)'],
  inventory: ['rgba(6, 182, 212, 0.6)', 'rgba(59, 130, 246, 0.6)'],
  research: ['rgba(168, 85, 247, 0.6)', 'rgba(236, 72, 153, 0.6)'],
  default: ['rgba(107, 114, 128, 0.6)', 'rgba(156, 163, 175, 0.6)'],
}

// =============================================================================
// Main Hook
// =============================================================================

export function useMeditativeCapture({
  initialUrl,
  collections: availableCollections = [],
  collectionItems,
  onComplete,
  onError,
  onDepart,
}: UseMeditativeCaptureOptions = {}): UseMeditativeCaptureReturn {
  // Main state - Now starts directly in 'spatial' phase with immediate Galaxy
  const [state, setState] = useState<MeditativeCaptureState>(() => {
    if (!initialUrl) {
      return { phase: 'error', error: 'No URL provided', canRetry: false }
    }
    // Start in 'arrival' temporarily - will transition to 'spatial' immediately
    return {
      phase: 'arrival',
      url: initialUrl,
      itemId: '', // Will be set after item creation
      seed: createInitialSeedState(),
    }
  })

  // Refs
  const isMountedRef = useRef(true)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const collectionsRef = useRef<Collection[]>(availableCollections)
  const collectionItemsRef = useRef<Map<string, Item[]> | undefined>(collectionItems)

  // Keep refs up to date
  useEffect(() => {
    collectionsRef.current = availableCollections
  }, [availableCollections])

  useEffect(() => {
    collectionItemsRef.current = collectionItems
  }, [collectionItems])

  // Update nebulae sampleItems when collectionItems data arrives
  useEffect(() => {
    if (!collectionItems || collectionItems.size === 0) return

    setState(prev => {
      if (prev.phase !== 'spatial') return prev

      // Update each nebula's sampleItems with the loaded items
      const updatedNebulae = prev.galaxy.nebulae.map(nebula => {
        const items = collectionItems.get(nebula.id)?.slice(0, 5) || []
        return {
          ...nebula,
          itemCount: items.length,
          sampleItems: items.map(item => ({
            id: item.id,
            title: item.title || '',
            imageUrl: item.image_url || undefined,
          })),
        }
      })

      return {
        ...prev,
        galaxy: {
          ...prev.galaxy,
          nebulae: updatedNebulae,
        },
      }
    })
  }, [collectionItems])

  // =============================================================================
  // Initialization: Create item immediately on mount
  // =============================================================================

  useEffect(() => {
    if (state.phase === 'arrival' && !state.itemId && initialUrl) {
      createItemAndStartExtraction(initialUrl)
    }
  }, [state.phase, initialUrl])

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  // =============================================================================
  // Core Actions
  // =============================================================================

  /**
   * Create item in DB and start extraction
   * IMMEDIATE GALAXY: Transitions directly to spatial phase
   * Extraction continues in background - Seed updates when data arrives
   */
  const createItemAndStartExtraction = useCallback(async (url: string) => {
    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!isMountedRef.current) return

      if (!response.ok) {
        setState({
          phase: 'error',
          error: data.error || 'Failed to create item',
          canRetry: true,
        })
        return
      }

      const item: Item = data.data?.item || data.data
      const itemId = item.id

      // IMMEDIATE GALAXY: Build galaxy and transition directly to spatial phase
      const currentCollections = collectionsRef.current
      const currentCollectionItems = collectionItemsRef.current

      // If no collections yet, create a minimal seed state and wait
      if (currentCollections.length === 0) {
        // Still in arrival - will retry when collections load
        setState(prev => {
          if (prev.phase !== 'arrival') return prev
          return {
            ...prev,
            itemId,
            seed: {
              ...prev.seed,
              extraction: { status: 'in_progress', progress: 0 },
              imageUrl: item.image_url || undefined,
              title: item.title || undefined,
            },
          }
        })
        // Retry transition when collections are available
        waitForCollectionsAndTransition(itemId, item)
        return
      }

      // Build galaxy immediately with collection items for orbiting display
      const galaxy = buildGalaxyFromCollections(currentCollections, currentCollectionItems)

      // Transition directly to spatial phase - Seed shows loading state
      setState({
        phase: 'spatial',
        url,
        itemId,
        item, // Item exists but may not have all extracted data yet
        galaxy,
        seed: {
          extraction: { status: 'in_progress', progress: 0 },
          position: { x: 0, y: 0 },
          isDragging: false,
          velocity: { x: 0, y: 0 },
          imageUrl: item.image_url || undefined,
          title: item.title || undefined,
        },
      })

      // Continue polling for extraction completion in background
      pollExtractionInBackground(itemId)
    } catch (error) {
      if (!isMountedRef.current) return
      setState({
        phase: 'error',
        error: 'Network error. Please try again.',
        canRetry: true,
      })
    }
  }, [])

  /**
   * Wait for collections to load, then transition to spatial phase
   * Used when collections aren't available at item creation time
   */
  const waitForCollectionsAndTransition = useCallback((itemId: string, item: Item) => {
    const checkCollections = () => {
      if (!isMountedRef.current) return

      const currentCollections = collectionsRef.current
      const currentCollectionItems = collectionItemsRef.current

      if (currentCollections.length === 0) {
        // Keep waiting
        setTimeout(checkCollections, 300)
        return
      }

      // Collections available - transition to spatial
      const galaxy = buildGalaxyFromCollections(currentCollections, currentCollectionItems)

      setState(prev => {
        if (prev.phase !== 'arrival') return prev
        return {
          phase: 'spatial',
          url: prev.url,
          itemId,
          item,
          galaxy,
          seed: {
            ...prev.seed,
            extraction: { status: 'in_progress', progress: 0 },
          },
        }
      })

      // Start polling for extraction
      pollExtractionInBackground(itemId)
    }

    // Start checking immediately
    checkCollections()
  }, [])

  /**
   * Poll for extraction completion in background
   * Updates the Seed with extracted data as it becomes available
   */
  const pollExtractionInBackground = useCallback((itemId: string) => {
    let pollCount = 0
    const maxPolls = 30 // ~30 seconds max

    // Simulate progress while waiting
    const progressInterval = setInterval(() => {
      if (!isMountedRef.current) {
        clearInterval(progressInterval)
        return
      }

      setState(prev => {
        if (prev.phase !== 'spatial') {
          clearInterval(progressInterval)
          return prev
        }

        const currentProgress = prev.seed.extraction.status === 'in_progress'
          ? prev.seed.extraction.progress
          : 0

        // Stop at 90% until real completion
        if (currentProgress >= 90) {
          return prev
        }

        return {
          ...prev,
          seed: {
            ...prev.seed,
            extraction: {
              status: 'in_progress',
              progress: Math.min(currentProgress + 5, 90),
            },
          },
        }
      })
    }, 200)

    // Poll for real extraction status
    const pollForCompletion = async () => {
      if (!isMountedRef.current || pollCount >= maxPolls) {
        clearInterval(progressInterval)
        return
      }

      pollCount++

      try {
        const response = await fetch(`/api/items/${itemId}`)
        if (response.ok) {
          const data = await response.json()
          const item: Item = data.data || data

          if (!isMountedRef.current) {
            clearInterval(progressInterval)
            return
          }

          // Check if extraction is complete (has title or extraction_status is complete)
          const isComplete = item.extraction_status === 'complete' ||
                            (item.title && item.image_url)

          if (isComplete) {
            clearInterval(progressInterval)
          }

          // Update with extracted data
          setState(prev => {
            if (prev.phase !== 'spatial') return prev
            return {
              ...prev,
              item,
              seed: {
                ...prev.seed,
                extraction: isComplete
                  ? { status: 'complete', item }
                  : { status: 'in_progress', progress: 95 },
                imageUrl: item.image_url || prev.seed.imageUrl,
                title: item.title || prev.seed.title,
              },
            }
          })

          if (!isComplete) {
            // Continue polling
            setTimeout(pollForCompletion, 1000)
          }
        } else {
          // Retry on error
          setTimeout(pollForCompletion, 2000)
        }
      } catch {
        // Retry on network error
        setTimeout(pollForCompletion, 2000)
      }
    }

    // Start polling after a short delay
    setTimeout(pollForCompletion, 500)
  }, [])

  // =============================================================================
  // Seed Interactions
  // =============================================================================

  const updateSeedPosition = useCallback((position: Vec2) => {
    setState(prev => {
      if (prev.phase !== 'spatial') return prev

      // Find nearest nebula
      let nearestNebula: string | undefined
      let nearestDistance = Infinity

      for (const nebula of prev.galaxy.nebulae) {
        const distance = vec2.dist(position, nebula.position)
        if (distance < nearestDistance && distance < nebula.radius * 2) {
          nearestDistance = distance
          nearestNebula = nebula.id
        }
      }

      // Update nebula activation states
      const updatedNebulae = prev.galaxy.nebulae.map(nebula => ({
        ...nebula,
        isActive: nebula.id === nearestNebula,
        gravitationalPull: nebula.id === nearestNebula
          ? Math.max(1, 2 - nearestDistance / nebula.radius)
          : 1,
      }))

      return {
        ...prev,
        seed: { ...prev.seed, position },
        galaxy: {
          ...prev.galaxy,
          nebulae: updatedNebulae,
          nearestNebula,
        },
      }
    })
  }, [])

  const startDragging = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'spatial') return prev
      return {
        ...prev,
        seed: { ...prev.seed, isDragging: true },
      }
    })
  }, [])

  const stopDragging = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'spatial') return prev
      return {
        ...prev,
        seed: { ...prev.seed, isDragging: false },
      }
    })
  }, [])

  // =============================================================================
  // Placement
  // =============================================================================

  const placeSeed = useCallback(async (collectionId: string) => {
    if (state.phase !== 'spatial') return

    const targetNebula = state.galaxy.nebulae.find(n => n.id === collectionId)
    if (!targetNebula) return

    // Find the collection object (use ref for latest value)
    const collection = collectionsRef.current.find(c => c.id === collectionId)
    if (!collection) return

    // Assign item to collection
    try {
      await fetch(`/api/collections/${collectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: state.itemId,
          notes: '', // Will be filled after inquiry
        }),
      })
    } catch (error) {
      console.error('Failed to assign to collection:', error)
      // Continue anyway - we can retry later
    }

    const placementResult: PlacementResult = {
      collectionId,
      collection,
      relatedItems: targetNebula.sampleItems.slice(0, 5),
      position: targetNebula.position,
    }

    // Fetch Socratic questions
    let questions: SocraticQuestion[] = []
    try {
      const response = await fetch('/api/reflection/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: state.itemId,
          collectionId,
          extractedMetadata: {
            title: state.item.title,
            type: state.item.item_type,
            attributes: state.item.attributes,
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        questions = data.questions || []
      }
    } catch {
      // Use fallback questions
      questions = getFallbackQuestions(state.item, collection)
    }

    // Transition to inquiry phase
    setState({
      phase: 'inquiry',
      url: state.url,
      itemId: state.itemId,
      item: state.item,
      placement: placementResult,
      dialogue: {
        questions,
        currentIndex: 0,
        answers: {},
        isTyping: true,
        isComplete: false,
      },
    })
  }, [state])

  // =============================================================================
  // Nebula Creation
  // =============================================================================

  const startLongPress = useCallback((position: Vec2) => {
    if (state.phase !== 'spatial') return

    setState(prev => {
      if (prev.phase !== 'spatial') return prev
      return {
        ...prev,
        galaxy: {
          ...prev.galaxy,
          isCreatingNebula: false,
          longPressPosition: position,
        },
      }
    })

    // Start timer for long press detection
    longPressTimerRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.phase !== 'spatial') return prev
        return {
          ...prev,
          galaxy: {
            ...prev.galaxy,
            isCreatingNebula: true,
          },
        }
      })
    }, 1000)
  }, [state.phase])

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    setState(prev => {
      if (prev.phase !== 'spatial') return prev
      return {
        ...prev,
        galaxy: {
          ...prev.galaxy,
          isCreatingNebula: false,
          longPressPosition: undefined,
        },
      }
    })
  }, [])

  const createNebula = useCallback(async (name: string) => {
    if (state.phase !== 'spatial' || !state.galaxy.longPressPosition) return

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: 'default',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create collection')
      }

      const data = await response.json()
      const newCollection: Collection = data.data || data

      // Add new nebula to galaxy
      const newNebula: Nebula = {
        id: newCollection.id,
        name: newCollection.name,
        type: 'default',
        position: state.galaxy.longPressPosition,
        radius: 50,
        itemCount: 0,
        themeColors: NEBULA_COLORS.default,
        themes: [],
        sampleItems: [],
        isActive: false,
        gravitationalPull: 1,
      }

      setState(prev => {
        if (prev.phase !== 'spatial') return prev
        return {
          ...prev,
          galaxy: {
            ...prev.galaxy,
            nebulae: [...prev.galaxy.nebulae, newNebula],
            isCreatingNebula: false,
            longPressPosition: undefined,
          },
        }
      })
    } catch (error) {
      onError?.('Failed to create collection')
      cancelLongPress()
    }
  }, [state, onError, cancelLongPress])

  // =============================================================================
  // Inquiry Phase
  // =============================================================================

  const submitAnswer = useCallback((answer: string) => {
    if (state.phase !== 'inquiry') return

    const currentQuestion = state.dialogue.questions[state.dialogue.currentIndex]
    if (!currentQuestion) return

    const updatedAnswers = {
      ...state.dialogue.answers,
      [currentQuestion.id]: answer,
    }

    const nextIndex = state.dialogue.currentIndex + 1
    const isComplete = nextIndex >= state.dialogue.questions.length

    setState(prev => {
      if (prev.phase !== 'inquiry') return prev
      return {
        ...prev,
        dialogue: {
          ...prev.dialogue,
          answers: updatedAnswers,
          currentIndex: nextIndex,
          isTyping: !isComplete,
          isComplete,
        },
      }
    })
  }, [state])

  const skipQuestion = useCallback(() => {
    if (state.phase !== 'inquiry') return

    const nextIndex = state.dialogue.currentIndex + 1
    const isComplete = nextIndex >= state.dialogue.questions.length

    setState(prev => {
      if (prev.phase !== 'inquiry') return prev
      return {
        ...prev,
        dialogue: {
          ...prev.dialogue,
          currentIndex: nextIndex,
          isTyping: !isComplete,
          isComplete,
        },
      }
    })
  }, [state])

  const completeInquiry = useCallback(async () => {
    if (state.phase !== 'inquiry') return

    // Synthesize notes from answers
    let synthesizedNotes: StructuredNotes

    try {
      const response = await fetch('/api/reflection/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: state.itemId,
          collectionId: state.placement.collectionId,
          questions: state.dialogue.questions,
          answers: state.dialogue.answers,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        synthesizedNotes = data.structuredNotes
      } else {
        throw new Error('Synthesis failed')
      }
    } catch {
      // Create notes from raw answers
      synthesizedNotes = createNotesFromAnswers(
        state.dialogue.questions,
        state.dialogue.answers
      )
    }

    // Update collection_items with notes
    try {
      await fetch(`/api/items/${state.itemId}/user-notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_id: state.placement.collectionId,
          notes: JSON.stringify(synthesizedNotes),
        }),
      })
    } catch {
      // Silently fail - notes are optional
    }

    // Transition to completion
    setState({
      phase: 'completion',
      item: state.item,
      collection: state.placement.collection,
      synthesizedNotes,
    })

    onComplete?.(state.item, state.placement.collection, synthesizedNotes)
  }, [state, onComplete])

  // =============================================================================
  // Departure & Reset
  // =============================================================================

  const depart = useCallback(() => {
    if (state.phase === 'arrival' || state.phase === 'spatial') {
      // Assign to inbox before departing (use ref for latest value)
      const inbox = collectionsRef.current.find(c => c.type === 'inbox')
      if (inbox && 'itemId' in state && state.itemId) {
        fetch(`/api/collections/${inbox.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: state.itemId }),
        }).catch(() => {
          // Silently fail
        })

        onDepart?.(state.itemId)
      }
    }

    setState({ phase: 'departed' })
  }, [state, onDepart])

  const updateViewTransform = useCallback((transform: { x: number; y: number; scale: number }) => {
    setState(prev => {
      if (prev.phase !== 'spatial') return prev
      return {
        ...prev,
        galaxy: {
          ...prev.galaxy,
          viewTransform: transform,
        },
      }
    })
  }, [])

  const retry = useCallback(() => {
    if (state.phase === 'error' && state.canRetry && initialUrl) {
      setState({
        phase: 'arrival',
        url: initialUrl,
        itemId: '',
        seed: createInitialSeedState(),
      })
    }
  }, [state, initialUrl])

  const reset = useCallback(() => {
    if (initialUrl) {
      setState({
        phase: 'arrival',
        url: initialUrl,
        itemId: '',
        seed: createInitialSeedState(),
      })
    }
  }, [initialUrl])

  return {
    state,
    updateSeedPosition,
    startDragging,
    stopDragging,
    placeSeed,
    startLongPress,
    cancelLongPress,
    createNebula,
    submitAnswer,
    skipQuestion,
    completeInquiry,
    depart,
    updateViewTransform,
    retry,
    reset,
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function createInitialSeedState(): SeedState {
  return {
    extraction: { status: 'pending' },
    position: { x: 0, y: 0 },
    isDragging: false,
    velocity: { x: 0, y: 0 },
  }
}

type NebulaType = 'inbox' | 'wishlist' | 'inventory' | 'research' | 'default'

/**
 * Build galaxy layout from collections
 * Collections are arranged in a circle around the center (where the seed is)
 * with proper spacing to avoid overlaps
 */
function buildGalaxyFromCollections(
  collections: Collection[],
  collectionItems?: Map<string, Item[]>
): GalaxyState {
  const baseRadius = 250 // Distance from center (seed)
  const nebulaSize = 70 // Fixed nebula visual radius

  const nebulae: Nebula[] = collections.map((collection, index) => {
    // Evenly distribute around center, starting at top (-PI/2)
    const angle = (index / collections.length) * Math.PI * 2 - Math.PI / 2

    // Slight organic variation to avoid perfect circle
    const radiusVariation = Math.sin(index * 1.5) * 20
    const radius = baseRadius + radiusVariation

    const validTypes: NebulaType[] = ['inbox', 'wishlist', 'inventory', 'research', 'default']
    const collectionType: NebulaType = validTypes.includes(collection.type as NebulaType)
      ? (collection.type as NebulaType)
      : 'default'
    const themeColors = NEBULA_COLORS[collectionType] || NEBULA_COLORS.default

    // Get actual items for this collection (top 5 most recent)
    const items = collectionItems?.get(collection.id)?.slice(0, 5) || []

    return {
      id: collection.id,
      name: collection.name,
      type: collectionType,
      position: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      },
      radius: nebulaSize,
      itemCount: items.length,
      themeColors,
      themes: [] as string[],
      sampleItems: items.map(item => ({
        id: item.id,
        title: item.title || '',
        imageUrl: item.image_url || undefined,
      })),
      isActive: false as const,
      gravitationalPull: 1,
    }
  })

  // No connection lines between collections
  return {
    nebulae,
    edges: [],
    viewTransform: { x: 0, y: 0, scale: 1 },
    isCreatingNebula: false,
  }
}

function getFallbackQuestions(item: Item, collection: Collection): SocraticQuestion[] {
  return [
    {
      id: 'intent',
      text: `What drew you to save this to "${collection.name}"?`,
      type: 'choice',
      options: ['Gift idea', 'Want to buy', 'Research', 'Inspiration', 'Just saving'],
    },
    {
      id: 'context',
      text: 'Any context you want to remember about this?',
      type: 'open',
    },
  ]
}

function createNotesFromAnswers(
  questions: SocraticQuestion[],
  answers: Record<string, string>
): StructuredNotes {
  const reflectionAnswers = questions
    .filter(q => answers[q.id])
    .map(q => ({
      question: q.text,
      answer: answers[q.id],
    }))

  // Try to detect intent from answers
  const intentAnswer = answers['intent']?.toLowerCase() || ''
  let intent: StructuredNotes['intent'] = 'collection'
  if (intentAnswer.includes('gift')) intent = 'gift'
  else if (intentAnswer.includes('buy') || intentAnswer.includes('purchase')) intent = 'purchase'
  else if (intentAnswer.includes('research')) intent = 'research'
  else if (intentAnswer.includes('inspir')) intent = 'inspiration'

  // Build raw text from answers
  const rawText = reflectionAnswers
    .map(ra => ra.answer)
    .filter(Boolean)
    .join('. ')

  return {
    raw_text: rawText || 'Saved for later',
    intent,
    connections: [],
    key_attributes: {},
    reflection_answers: reflectionAnswers,
  }
}

export default useMeditativeCapture
