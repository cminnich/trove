'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import type { Database } from '@/types/database'
import { useCaptureState } from './hooks/useCaptureState'
import { SourceUrlBadge } from './components/SourceUrlBadge'
import { MockProgressBar } from './components/MockProgressBar'
import { ContextForm } from './components/ContextForm'
import { CollectionSelector } from './components/CollectionSelector'
import { ExtractedItemCard } from './components/ExtractedItemCard'
import { ProcessingCard } from './components/ProcessingCard'
import { CaptureActions } from './components/CaptureActions'
import { PhotoCapture } from './components/PhotoCapture'
import { PhotoBatchResults } from './components/PhotoBatchResults'
import { getClient } from '@/lib/supabase-client'

type Item = Database['public']['Tables']['items']['Row']
type Collection = Database['public']['Tables']['collections']['Row']

function AddPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlParam = searchParams?.get('url')

  // Track the previous URL param to detect changes
  const [currentUrl, setCurrentUrl] = useState<string | null>(urlParam || null)

  // Auth state
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)

  // Detect URL param changes and force reload for clean state
  useEffect(() => {
    const newUrl = urlParam || null
    if (currentUrl !== newUrl) {
      // URL changed - reload to get clean state
      if (newUrl === null) {
        // Navigated to /add without URL - force full reload
        window.location.href = '/add'
      } else if (currentUrl !== null) {
        // URL changed to a different value - reload with new URL
        window.location.href = `/add?url=${encodeURIComponent(newUrl)}`
      }
      setCurrentUrl(newUrl)
    }
  }, [urlParam, currentUrl])

  // Capture state management
  // Note: Don't pass undefined when authLoading - it will initialize the hook with error state
  // Instead, we'll handle the loading state before rendering the hook's UI
  const { state, context, saveIntent, updateContext, triggerSave, reset, retry, completeProcessing } = useCaptureState({
    initialUrl: urlParam || undefined,
    collections, // Pass collections for inbox fallback
    onSuccess: () => {
      // Success callback - item is fully processed
    },
    onError: (error) => {
      console.error('Capture error:', error)
    }
  })

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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch collections and ensure Inbox exists (only when authenticated)
  const loadCollections = async () => {
    // Only load collections if user is authenticated
    if (!user) {
      setCollectionsLoading(false)
      return
    }

    try {
      setCollectionsLoading(true)
      // Fetch all collections via API endpoint (respects authentication)
      // Note: API automatically ensures Inbox collection exists
      const response = await fetch('/api/collections')
      const result = await response.json()

      if (!result.success || result.error) {
        console.error('Error fetching collections:', result.error)
        setCollections([])
      } else {
        const collections = result.data as Collection[] || []
        setCollections(collections)
        // Note: Inbox auto-selection is now handled by CollectionSelector's smart fallback
      }
    } catch (error) {
      console.error('Error loading collections:', error)
      setCollections([])
    } finally {
      setCollectionsLoading(false)
    }
  }

  useEffect(() => {
    loadCollections()
  }, [user]) // Re-run when user changes

  // Validation: Check if save is allowed
  // With smart inbox fallback, we can always save (inbox is default target)
  const hasInboxFallback = collections.some(c => c.type === 'inbox')
  const canSave = hasInboxFallback || context.notes.trim().length > 0 || context.selectedCollections.length > 0

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isSaving = state.stage === 'saving'

      // Cmd/Ctrl+Enter: Save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSave && !isSaving) {
        e.preventDefault()
        triggerSave()
      }
      // Escape: Cancel
      if (e.key === 'Escape' && state.stage !== 'complete') {
        e.preventDefault()
        reset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canSave, state.stage, triggerSave, reset])

  // Auth loading
  if (authLoading) {
    return <LoadingFallback />
  }

  // Not authenticated: Redirect to login page
  if (!user) {
    const currentPath = `/add${urlParam ? `?url=${encodeURIComponent(urlParam)}` : ''}`
    router.push(`/auth/login?next=${encodeURIComponent(currentPath)}`)
    return <LoadingFallback />
  }

  // Idle state: No URL provided (manual entry) - show manual entry form
  // This catches the "No URL provided" error state and shows the manual entry form instead
  if (!urlParam && user) {
    if (state.stage === 'error' && state.error === 'No URL provided') {
      return <ManualEntryView user={user} />
    }
  }

  // Handler for "Add Another Item" - navigates to clean /add page
  const handleAddAnother = () => {
    // Use window.location to force full page reload and reset all state
    // router.push doesn't remount the component, so state persists
    window.location.href = '/add'
  }

  // Render different stages
  if (state.stage === 'complete') {
    return <SuccessView item={state.item} collections={state.collections} onAddAnother={handleAddAnother} />
  }

  if (state.stage === 'error') {
    return <ErrorView error={state.error} canRetry={state.canRetry} onRetry={retry} onReset={reset} />
  }

  // Processing state: Show ProcessingView with shimmer card
  if (state.stage === 'processing') {
    return (
      <ProcessingView
        state={state}
        onAddAnother={handleAddAnother}
        onComplete={completeProcessing}
      />
    )
  }

  // Capturing or Saving state: Show CaptureForm flow
  const isSaving = state.stage === 'saving'
  const isCapturing = state.stage === 'capturing'
  const extractionComplete = isCapturing && state.extraction.status === 'complete'
  const isExistingItem = isCapturing && state.extraction.status === 'complete' && state.extraction.isExisting
  const existingMemberships = isCapturing && state.extraction.status === 'complete' ? state.extraction.existingMemberships || [] : []

  return (
    <main className="flex min-h-screen flex-col p-6 bg-void">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-mono font-bold text-white tracking-wide">
            {isExistingItem ? 'UPDATE IN TROVE' : 'ADD TO TROVE'}
          </h1>
        </div>

        {/* Already in Trove indicator */}
        {isExistingItem && existingMemberships.length > 0 && (
          <div className="bg-open-green/10 border border-open-green/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-open-green text-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-mono font-medium text-open-green">
                  Already in your Trove
                </p>
                <p className="text-sm text-slate-300 font-mono mt-1">
                  Currently saved in: {existingMemberships.map(m => m.collection_name).join(', ')}
                </p>
                <p className="text-xs text-slate-400 font-mono mt-2">
                  You can update the notes or add to more collections below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Source URL Badge */}
        {isCapturing && <SourceUrlBadge url={state.url} />}

        {/* Progress Bar */}
        {isCapturing && (
          <MockProgressBar extractionState={state.extraction} />
        )}

        {/* Context Form */}
        <ContextForm
          value={context}
          onChange={updateContext}
          disabled={isSaving}
        />

        {/* Collection Selector */}
        <CollectionSelector
          collections={collections}
          value={context}
          onChange={updateContext}
          disabled={isSaving}
          loading={collectionsLoading}
          onCollectionsChange={loadCollections}
        />

        {/* Extracted Item Card */}
        {isCapturing && (
          <div className="space-y-4">
            <h3 className="text-sm font-mono font-medium text-slate-400">
              // Extracted Item
            </h3>
            <ExtractedItemCard extractionState={state.extraction} />
          </div>
        )}

        {/* Actions */}
        <CaptureActions
          canSave={canSave}
          isSaving={isSaving}
          extractionComplete={extractionComplete}
          saveIntent={saveIntent}
          isExisting={isExistingItem && existingMemberships.length > 0}
          onSave={triggerSave}
          onCancel={reset}
        />
      </div>
    </main>
  )
}

// Wrap in Suspense for useSearchParams
export default function AddPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AddPageContent />
    </Suspense>
  )
}

// Loading Fallback
function LoadingFallback() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-void">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-4 border-slate-800 border-t-open-green rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-mono text-sm">Loading...</p>
      </div>
    </main>
  )
}

// Success View Component
function SuccessView({
  item,
  collections,
  onAddAnother
}: {
  item: Item
  collections: string[]
  onAddAnother: () => void
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-void">
      <div className="w-full max-w-md">
        {/* Success header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2 text-open-green">✓</div>
          <h2 className="text-2xl font-mono font-bold text-white tracking-wide">
            ADDED TO TROVE
          </h2>
          {collections.length > 0 && (
            <p className="text-sm text-slate-400 font-mono mt-2">
              Saved to {collections.length} collection{collections.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Item preview */}
        <div className="bg-slate-deep rounded-lg border border-slate-800 p-6 mb-6 shadow-hard">
          {item.image_url && (
            <img
              src={item.image_url}
              alt={item.title || 'Item image'}
              className="w-full h-48 object-contain mb-4 rounded"
            />
          )}

          <h3 className="text-xl font-mono font-semibold mb-2 text-white">
            {item.title}
          </h3>

          {item.brand && (
            <p className="text-slate-400 font-mono mb-2">{item.brand}</p>
          )}

          {item.price && item.currency && (
            <p className="text-2xl font-bold mb-2 text-open-green font-mono">
              {item.currency === 'USD' && '$'}
              {item.price.toLocaleString()}
              {item.currency !== 'USD' && ` ${item.currency}`}
            </p>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={onAddAnother}
          className="w-full bg-open-green hover:bg-emerald-400 text-void font-mono font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Add Another Item
        </button>
      </div>
    </main>
  )
}

// Error View Component
function ErrorView({
  error,
  canRetry,
  onRetry,
  onReset
}: {
  error: string
  canRetry: boolean
  onRetry: () => void
  onReset: () => void
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-void">
      <div className="w-full max-w-md text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-mono font-bold mb-2 text-white tracking-wide">
          ERROR
        </h2>
        <p className="text-slate-400 font-mono mb-6">{error}</p>

        <div className="space-y-3">
          {canRetry && (
            <button
              onClick={onRetry}
              className="w-full bg-open-green hover:bg-emerald-400 text-void font-mono font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Retry
            </button>
          )}

          <button
            onClick={onReset}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-medium py-3 px-4 rounded-lg transition-colors border border-slate-700"
          >
            Go Back
          </button>
        </div>
      </div>
    </main>
  )
}

// Processing View Component - shown after save while deep extraction runs
function ProcessingView({
  state,
  onAddAnother,
  onComplete
}: {
  state: Extract<import('@/types/capture').CaptureState, { stage: 'processing' }>
  onAddAnother: () => void
  onComplete: () => void
}) {
  const isComplete = state.deepExtraction.status === 'complete'
  const isFailed = state.deepExtraction.status === 'failed'

  return (
    <main className="flex min-h-screen flex-col p-6 bg-void">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-mono font-bold text-white tracking-wide">
            {isComplete ? 'ADDED TO TROVE' : 'PROCESSING...'}
          </h1>
          {!isComplete && !isFailed && (
            <p className="text-sm text-slate-400 font-mono mt-1">
              // Enhancing your item with AI
            </p>
          )}
        </div>

        {/* Processing Card */}
        <ProcessingCard
          item={state.item}
          url={state.url}
          context={state.context}
          collections={state.collections}
          deepExtraction={state.deepExtraction}
        />

        {/* Actions - only show when complete or failed */}
        {(isComplete || isFailed) && (
          <div className="space-y-3">
            <button
              onClick={onAddAnother}
              className="w-full bg-open-green hover:bg-emerald-400 text-void font-mono font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Add Another Item
            </button>

            {state.collections.length > 0 && (
              <a
                href={`/collections/${state.collections[0].id}`}
                className="block w-full text-center bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-medium py-3 px-4 rounded-lg border border-slate-700 transition-colors"
              >
                View in {state.collections[0].name}
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

// Photo identification state types
type PhotoState =
  | { stage: 'idle' }
  | { stage: 'identifying' }
  | { stage: 'results'; items: any[]; sceneDescription: string }
  | { stage: 'error'; message: string }

// Manual Entry View Component
function ManualEntryView({ user }: { user: any }) {
  const [url, setUrl] = useState('')
  const [isValid, setIsValid] = useState(true)
  const [photoState, setPhotoState] = useState<PhotoState>({ stage: 'idle' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Basic URL validation
    try {
      new URL(url)
      // Navigate to /add with the URL parameter
      window.location.href = `/add?url=${encodeURIComponent(url)}`
    } catch {
      setIsValid(false)
    }
  }

  const handlePhotoCapture = async (imageBase64: string, mimeType: string) => {
    setPhotoState({ stage: 'identifying' })

    try {
      const response = await fetch('/api/items/photo-identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, mimeType }),
      })

      const result = await response.json()

      if (!result.success) {
        setPhotoState({ stage: 'error', message: result.error || 'Identification failed' })
        return
      }

      if (!result.items || result.items.length === 0) {
        setPhotoState({
          stage: 'error',
          message: result.scene_description
            ? `No products identified. Scene: ${result.scene_description}`
            : 'No products could be identified in this photo',
        })
        return
      }

      setPhotoState({
        stage: 'results',
        items: result.items,
        sceneDescription: result.scene_description || '',
      })
    } catch (err) {
      setPhotoState({
        stage: 'error',
        message: err instanceof Error ? err.message : 'Failed to identify photo',
      })
    }
  }

  const handleSelectUrl = (selectedUrl: string) => {
    window.location.href = `/add?url=${encodeURIComponent(selectedUrl)}`
  }

  const handleCreateWithoutUrl = (item: any) => {
    // Future: create item directly from photo data
    // For now, pre-fill the URL field with a search
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(item.search_query)}`
    window.open(searchUrl, '_blank')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-void">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-mono font-bold mb-2 text-white tracking-wide">
            ADD TO TROVE
          </h1>
          <p className="text-slate-400 font-mono text-sm">
            // Enter a URL or snap a photo
          </p>
        </div>

        {/* Photo results view */}
        {photoState.stage === 'results' && (
          <div className="mb-6">
            <PhotoBatchResults
              items={photoState.items}
              sceneDescription={photoState.sceneDescription}
              onSelectUrl={handleSelectUrl}
              onCreateWithoutUrl={handleCreateWithoutUrl}
              onCancel={() => setPhotoState({ stage: 'idle' })}
            />
          </div>
        )}

        {/* Photo error */}
        {photoState.stage === 'error' && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <p className="text-sm font-mono text-red-400 mb-2">{photoState.message}</p>
            <button
              onClick={() => setPhotoState({ stage: 'idle' })}
              className="text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Identifying spinner */}
        {photoState.stage === 'identifying' && (
          <div className="mb-6 flex flex-col items-center py-8">
            <div className="inline-block w-10 h-10 border-4 border-slate-800 border-t-open-green rounded-full animate-spin mb-4" />
            <p className="text-sm font-mono text-slate-400">Identifying products...</p>
            <p className="text-xs font-mono text-slate-600 mt-1">Analyzing photo with AI</p>
          </div>
        )}

        {/* URL form (always visible unless showing results) */}
        {photoState.stage !== 'results' && (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="url" className="block text-sm font-mono font-medium text-slate-300 mb-2">
                  URL
                </label>
                <input
                  type="text"
                  id="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value)
                    setIsValid(true)
                  }}
                  placeholder="https://example.com/product"
                  className={`w-full px-4 py-3 rounded-lg border font-mono ${
                    isValid
                      ? 'border-slate-800'
                      : 'border-red-500'
                  } bg-slate-deep text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-open-green`}
                  autoFocus
                  disabled={photoState.stage === 'identifying'}
                />
                {!isValid && (
                  <p className="mt-2 text-sm text-red-400 font-mono">
                    Please enter a valid URL
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!url.trim() || photoState.stage === 'identifying'}
                className="w-full bg-open-green hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-void font-mono font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Extract & Save
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 border-t border-slate-800" />
              <span className="text-xs font-mono text-slate-600">or</span>
              <div className="flex-1 border-t border-slate-800" />
            </div>

            {/* Photo capture */}
            <PhotoCapture
              onCapture={handlePhotoCapture}
              disabled={photoState.stage === 'identifying'}
            />
          </>
        )}

        <div className="mt-8 pt-8 border-t border-slate-800">
          <p className="text-sm text-slate-400 font-mono text-center mb-2">
            Tip: Use the iOS Share Sheet shortcut for faster capturing
          </p>
          <p className="text-xs text-slate-500 font-mono text-center">
            Signed in as {user.email}
          </p>
        </div>
      </div>
    </main>
  )
}