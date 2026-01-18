'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Database } from '@/types/database'
import { useMeditativeCapture } from './hooks/useMeditativeCapture'
import { GalaxyCanvas } from '@/app/components/Galaxy'
import { InquiryFlow } from './components/InquiryFlow'
import { BreathingPulse, ProgressiveReveal, AmbientGlowBorder } from './components/animations'
import { getClient } from '@/lib/supabase-client'
import {
  isArrivalPhase,
  isSpatialPhase,
  isInquiryPhase,
  isCompletionPhase,
  type Nebula,
} from '@/types/meditative-capture'
import Image from 'next/image'

type Item = Database['public']['Tables']['items']['Row']
type Collection = Database['public']['Tables']['collections']['Row']

// Feature flag: Set to true to use the new meditative flow
const USE_MEDITATIVE_FLOW = true

function MeditativeAddPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlParam = searchParams?.get('url')

  // Auth state
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionItems, setCollectionItems] = useState<Map<string, Item[]>>(new Map())
  const [collectionsLoading, setCollectionsLoading] = useState(true)

  // Check auth session on mount
  useEffect(() => {
    const supabase = getClient()

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Error checking auth:', error)
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch collections and their items (for orbiting display)
  useEffect(() => {
    if (!user) {
      setCollectionsLoading(false)
      return
    }

    async function loadCollections() {
      try {
        setCollectionsLoading(true)
        const response = await fetch('/api/collections')
        const result = await response.json()

        if (result.success && result.data) {
          const fetchedCollections = result.data as Collection[]
          setCollections(fetchedCollections)

          // Fetch items for each collection (top 5 most recent for orbiting display)
          const itemsMap = new Map<string, Item[]>()
          await Promise.all(
            fetchedCollections.map(async (col) => {
              try {
                const res = await fetch(`/api/collections/${col.id}/items?sort=recent&limit=5`)
                const data = await res.json()
                if (data.success && data.data) {
                  itemsMap.set(col.id, data.data)
                }
              } catch (err) {
                console.error(`Error loading items for collection ${col.id}:`, err)
              }
            })
          )
          setCollectionItems(itemsMap)
        }
      } catch (error) {
        console.error('Error loading collections:', error)
      } finally {
        setCollectionsLoading(false)
      }
    }

    loadCollections()
  }, [user])

  // Meditative capture state
  const {
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
  } = useMeditativeCapture({
    initialUrl: urlParam || undefined,
    collections,
    collectionItems,
    onComplete: (item, collection, notes) => {
      console.log('Capture complete:', { item, collection, notes })
    },
    onError: (error) => {
      console.error('Capture error:', error)
    },
    onDepart: (itemId) => {
      console.log('User departed, item saved to inbox:', itemId)
    },
  })

  // Auth loading
  if (authLoading) {
    return <MeditativeLoadingFallback />
  }

  // Not authenticated
  if (!user) {
    const currentPath = `/add${urlParam ? `?url=${encodeURIComponent(urlParam)}` : ''}`
    router.push(`/auth/login?next=${encodeURIComponent(currentPath)}`)
    return <MeditativeLoadingFallback />
  }

  // No URL provided
  if (!urlParam) {
    return <MeditativeManualEntry user={user} />
  }

  // Collections loading - show arrival phase early
  if (collectionsLoading && isArrivalPhase(state)) {
    return (
      <MeditativeContainer>
        <ArrivalPhaseView
          state={state}
          onDepart={depart}
        />
      </MeditativeContainer>
    )
  }

  // Error state
  if (state.phase === 'error') {
    return (
      <MeditativeContainer>
        <ErrorPhaseView
          error={state.error}
          canRetry={state.canRetry}
          onRetry={retry}
          onDepart={depart}
        />
      </MeditativeContainer>
    )
  }

  // Departed state
  if (state.phase === 'departed') {
    return (
      <MeditativeContainer>
        <DepartedView onReset={reset} />
      </MeditativeContainer>
    )
  }

  // Arrival phase
  if (isArrivalPhase(state)) {
    return (
      <MeditativeContainer>
        <ArrivalPhaseView
          state={state}
          onDepart={depart}
        />
      </MeditativeContainer>
    )
  }

  // Spatial phase (Galaxy) - tap-to-place interaction
  if (isSpatialPhase(state)) {
    return (
      <MeditativeContainer>
        <SpatialPhaseView
          state={state}
          onSeedPlaced={placeSeed}
          onStartLongPress={startLongPress}
          onCancelLongPress={cancelLongPress}
          onCreateNebula={createNebula}
          onViewTransformChange={updateViewTransform}
          onDepart={depart}
        />
      </MeditativeContainer>
    )
  }

  // Inquiry phase
  if (isInquiryPhase(state)) {
    return (
      <InquiryFlow
        item={state.item}
        placement={state.placement}
        dialogue={state.dialogue}
        onSubmitAnswer={submitAnswer}
        onSkip={skipQuestion}
        onComplete={completeInquiry}
      />
    )
  }

  // Completion phase
  if (isCompletionPhase(state)) {
    return (
      <MeditativeContainer>
        <CompletionPhaseView
          state={state}
          onReset={reset}
        />
      </MeditativeContainer>
    )
  }

  // Fallback
  return <MeditativeLoadingFallback />
}

// =============================================================================
// Phase Views
// =============================================================================

function ArrivalPhaseView({
  state,
  onDepart,
}: {
  state: Extract<import('@/types/meditative-capture').MeditativeCaptureState, { phase: 'arrival' }>
  onDepart: () => void
}) {
  const progress = state.seed.extraction.status === 'in_progress'
    ? state.seed.extraction.progress
    : state.seed.extraction.status === 'complete' ? 100 : 0

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      {/* Seed visualization */}
      <ProgressiveReveal delay={0.3}>
        <BreathingPulse duration={4} scale={1.05}>
          <div className="relative w-32 h-32">
            {/* Outer glow */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)',
                transform: 'scale(2)',
                filter: 'blur(20px)',
              }}
            />

            {/* Core */}
            <AmbientGlowBorder theme="primary" borderRadius="9999px">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-zen-void-subtle flex items-center justify-center">
                {state.seed.imageUrl ? (
                  <Image
                    src={state.seed.imageUrl}
                    alt="Item"
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                ) : (
                  <motion.div
                    className="text-4xl"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    ✨
                  </motion.div>
                )}
              </div>
            </AmbientGlowBorder>
          </div>
        </BreathingPulse>
      </ProgressiveReveal>

      {/* Status text */}
      <ProgressiveReveal delay={0.6} className="mt-8 text-center">
        <h1 className="text-xl font-reflective text-zen-text-reflective mb-2">
          Saved to Trove
        </h1>
        <p className="text-sm text-zen-text-muted font-data">
          {progress < 100 ? 'Preparing your item...' : 'Ready to place'}
        </p>
      </ProgressiveReveal>

      {/* Progress indicator */}
      <ProgressiveReveal delay={0.9} className="mt-6 w-48">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-zen-glow-primary to-zen-glow-secondary"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </ProgressiveReveal>

      {/* Depart option */}
      <ProgressiveReveal delay={1.2} className="mt-12">
        <button
          onClick={onDepart}
          className="text-zen-text-muted text-sm hover:text-zen-text-reflective transition-colors"
        >
          Close and save to Inbox →
        </button>
      </ProgressiveReveal>
    </div>
  )
}

function SpatialPhaseView({
  state,
  onSeedPlaced,
  onStartLongPress,
  onCancelLongPress,
  onCreateNebula,
  onViewTransformChange,
  onDepart,
}: {
  state: Extract<import('@/types/meditative-capture').MeditativeCaptureState, { phase: 'spatial' }>
  onSeedPlaced: (collectionId: string) => Promise<void>
  onStartLongPress: (pos: import('@/types/meditative-capture').Vec2) => void
  onCancelLongPress: () => void
  onCreateNebula: (name: string) => Promise<void>
  onViewTransformChange: (transform: { x: number; y: number; scale: number }) => void
  onDepart: () => void
}) {
  const [showNewNebulaInput, setShowNewNebulaInput] = useState(false)
  const [newNebulaName, setNewNebulaName] = useState('')

  const handleNebulaeUpdate = (nebulae: Nebula[]) => {
    // Nebulae positions are managed by the state machine
  }

  const handleStartNebulaCreation = (position: import('@/types/meditative-capture').Vec2) => {
    onStartLongPress(position)
    setShowNewNebulaInput(true)
  }

  const handleCreateNebula = async () => {
    if (newNebulaName.trim()) {
      await onCreateNebula(newNebulaName.trim())
      setNewNebulaName('')
      setShowNewNebulaInput(false)
    }
  }

  return (
    <div className="fixed inset-0">
      <GalaxyCanvas
        galaxy={state.galaxy}
        seed={state.seed}
        mode="capture"
        onSeedPlaced={onSeedPlaced}
        onStartNebulaCreation={handleStartNebulaCreation}
        onNebulaeUpdate={handleNebulaeUpdate}
        onViewTransformChange={onViewTransformChange}
      />

      {/* Depart button */}
      <button
        onClick={onDepart}
        className="absolute top-4 right-4 text-zen-text-muted text-sm hover:text-zen-text-reflective transition-colors z-10"
      >
        Save to Inbox ×
      </button>

      {/* Item info */}
      <div className="absolute top-4 left-4 z-10">
        <p className="text-zen-text-reflective font-reflective text-lg">
          {state.item.title || 'New Item'}
        </p>
        <p className="text-zen-text-muted text-sm font-data">
          Tap a collection to place
        </p>
      </div>

      {/* New nebula input modal */}
      <AnimatePresence>
        {showNewNebulaInput && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-zen-void-subtle border border-white/20 rounded-2xl p-6 w-80"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-lg font-reflective text-zen-text-reflective mb-4">
                Create New Collection
              </h3>
              <input
                type="text"
                value={newNebulaName}
                onChange={(e) => setNewNebulaName(e.target.value)}
                placeholder="Collection name"
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20
                         text-zen-text-reflective placeholder-zen-text-muted
                         focus:outline-none focus:border-white/40"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNebula()
                  if (e.key === 'Escape') {
                    setShowNewNebulaInput(false)
                    onCancelLongPress()
                  }
                }}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowNewNebulaInput(false)
                    onCancelLongPress()
                  }}
                  className="flex-1 py-2 rounded-lg border border-white/20 text-zen-text-muted
                           hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNebula}
                  disabled={!newNebulaName.trim()}
                  className="flex-1 py-2 rounded-lg bg-white/10 text-zen-text-reflective
                           hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CompletionPhaseView({
  state,
  onReset,
}: {
  state: Extract<import('@/types/meditative-capture').MeditativeCaptureState, { phase: 'completion' }>
  onReset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      {/* Success bloom */}
      <motion.div
        className="relative"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {/* Glow rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-green-400/30"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{
              scale: 1 + i * 0.3,
              opacity: 0,
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.4,
            }}
          />
        ))}

        {/* Core success icon */}
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
          <motion.svg
            className="w-12 h-12 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </motion.svg>
        </div>
      </motion.div>

      {/* Text */}
      <ProgressiveReveal delay={0.5} className="mt-8 text-center">
        <h1 className="text-2xl font-reflective text-zen-text-reflective mb-2">
          Added to {state.collection.name}
        </h1>
        <p className="text-zen-text-muted font-data text-sm">
          {state.synthesizedNotes.raw_text}
        </p>
      </ProgressiveReveal>

      {/* Item preview */}
      <ProgressiveReveal delay={0.8} className="mt-8">
        <div className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
          {state.item.image_url && (
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <Image
                src={state.item.image_url}
                alt={state.item.title || 'Item'}
                width={64}
                height={64}
                className="object-cover w-full h-full"
              />
            </div>
          )}
          <div>
            <p className="font-reflective text-zen-text-reflective">
              {state.item.title}
            </p>
            {state.item.brand && (
              <p className="text-zen-text-muted text-sm">{state.item.brand}</p>
            )}
          </div>
        </div>
      </ProgressiveReveal>

      {/* Actions */}
      <ProgressiveReveal delay={1.1} className="mt-12 flex gap-4">
        <button
          onClick={onReset}
          className="px-6 py-3 rounded-xl bg-white/10 text-zen-text-reflective
                   hover:bg-white/15 transition-colors font-reflective"
        >
          Add Another
        </button>
        <a
          href={`/collections/${state.collection.id}`}
          className="px-6 py-3 rounded-xl border border-white/20 text-zen-text-muted
                   hover:border-white/40 hover:text-zen-text-reflective transition-colors font-reflective"
        >
          View Collection
        </a>
      </ProgressiveReveal>
    </div>
  )
}

function ErrorPhaseView({
  error,
  canRetry,
  onRetry,
  onDepart,
}: {
  error: string
  canRetry: boolean
  onRetry: () => void
  onDepart: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <motion.div
        className="text-5xl mb-6"
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 0.5 }}
      >
        ⚠️
      </motion.div>

      <h1 className="text-xl font-reflective text-zen-text-reflective mb-2">
        Something went wrong
      </h1>
      <p className="text-zen-text-muted text-sm mb-8 text-center max-w-xs">
        {error}
      </p>

      <div className="flex gap-4">
        {canRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-3 rounded-xl bg-white/10 text-zen-text-reflective
                     hover:bg-white/15 transition-colors"
          >
            Try Again
          </button>
        )}
        <button
          onClick={onDepart}
          className="px-6 py-3 rounded-xl border border-white/20 text-zen-text-muted
                   hover:border-white/40 transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  )
}

function DepartedView({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <ProgressiveReveal>
        <h1 className="text-xl font-reflective text-zen-text-reflective mb-2">
          Saved to Inbox
        </h1>
        <p className="text-zen-text-muted text-sm mb-8">
          Your item is waiting for you
        </p>
      </ProgressiveReveal>

      <ProgressiveReveal delay={0.3}>
        <button
          onClick={onReset}
          className="px-6 py-3 rounded-xl bg-white/10 text-zen-text-reflective
                   hover:bg-white/15 transition-colors"
        >
          Add Another
        </button>
      </ProgressiveReveal>
    </div>
  )
}

// =============================================================================
// Utility Components
// =============================================================================

function MeditativeContainer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add('meditative-mode')
    return () => document.body.classList.remove('meditative-mode')
  }, [])

  return (
    <main className="min-h-screen bg-zen-void text-zen-text-reflective">
      <div className="meditative-backdrop" />
      {children}
    </main>
  )
}

function MeditativeLoadingFallback() {
  useEffect(() => {
    document.body.classList.add('meditative-mode')
    return () => document.body.classList.remove('meditative-mode')
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zen-void">
      <div className="meditative-backdrop" />
      <BreathingPulse duration={3}>
        <div className="w-16 h-16 rounded-full border-2 border-zen-glow-primary/30 border-t-zen-glow-primary animate-spin" />
      </BreathingPulse>
    </main>
  )
}

function MeditativeManualEntry({ user }: { user: any }) {
  const [url, setUrl] = useState('')
  const [isValid, setIsValid] = useState(true)

  useEffect(() => {
    document.body.classList.add('meditative-mode')
    return () => document.body.classList.remove('meditative-mode')
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      new URL(url)
      window.location.href = `/add?url=${encodeURIComponent(url)}`
    } catch {
      setIsValid(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-zen-void">
      <div className="meditative-backdrop" />

      <div className="w-full max-w-md relative z-10">
        <ProgressiveReveal className="text-center mb-12">
          <h1 className="text-3xl font-reflective text-zen-text-reflective mb-3">
            Add to Trove
          </h1>
          <p className="text-zen-text-muted">
            Enter a URL to begin
          </p>
        </ProgressiveReveal>

        <ProgressiveReveal delay={0.3}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setIsValid(true)
                }}
                placeholder="https://..."
                className={`w-full px-5 py-4 rounded-xl bg-white/5 border ${
                  isValid ? 'border-white/20' : 'border-red-500/50'
                } text-zen-text-reflective placeholder-zen-text-muted
                focus:outline-none focus:border-white/40 font-data`}
                autoFocus
              />
              {!isValid && (
                <p className="mt-2 text-sm text-red-400">Please enter a valid URL</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!url.trim()}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-zen-glow-primary to-zen-glow-secondary
                       text-white font-reflective text-lg
                       hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-opacity"
            >
              Begin
            </button>
          </form>
        </ProgressiveReveal>

        <ProgressiveReveal delay={0.6} className="mt-12 text-center">
          <p className="text-zen-text-muted text-sm">
            Tip: Use the iOS Share Sheet for faster capturing
          </p>
          <p className="text-zen-text-muted/60 text-xs mt-2">
            Signed in as {user.email}
          </p>
        </ProgressiveReveal>
      </div>
    </main>
  )
}

// =============================================================================
// Export
// =============================================================================

export default function AddPage() {
  return (
    <Suspense fallback={<MeditativeLoadingFallback />}>
      <MeditativeAddPageContent />
    </Suspense>
  )
}
