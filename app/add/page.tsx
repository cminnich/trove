'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import type { Database } from '@/types/database'
import { useCaptureState } from './hooks/useCaptureState'
import { SourceUrlBadge } from './components/SourceUrlBadge'
import { MockProgressBar } from './components/MockProgressBar'
import { ContextForm } from './components/ContextForm'
import { CollectionSelector } from './components/CollectionSelector'
import { ExtractedItemCard } from './components/ExtractedItemCard'
import { RecentlyTroved } from './components/RecentlyTroved'
import { CaptureActions } from './components/CaptureActions'
import { ensureInboxCollection } from '@/lib/inbox'
import { supabase } from '@/lib/supabase'

type Item = Database['public']['Tables']['items']['Row']
type Collection = Database['public']['Tables']['collections']['Row']

function AddPageContent() {
  const searchParams = useSearchParams()
  const urlParam = searchParams?.get('url')

  // Auth state
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)

  // Recent items state
  const [recentItems, setRecentItems] = useState<Item[]>([])
  const [recentItemsLoading, setRecentItemsLoading] = useState(true)

  // Capture state management
  // Note: Don't pass undefined when authLoading - it will initialize the hook with error state
  // Instead, we'll handle the loading state before rendering the hook's UI
  const { state, context, saveIntent, updateContext, triggerSave, reset, retry } = useCaptureState({
    initialUrl: urlParam || undefined,
    onSuccess: () => {
      // Refresh recent items after successful save
      fetchRecentItems()
    },
    onError: (error) => {
      console.error('Capture error:', error)
    }
  })

  // Check auth session on mount
  useEffect(() => {
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
  useEffect(() => {
    async function loadCollections() {
      // Only load collections if user is authenticated
      if (!user) {
        setCollectionsLoading(false)
        return
      }

      try {
        // Ensure Inbox collection exists
        await ensureInboxCollection(supabase)

        // Fetch all collections
        const { data, error } = await supabase
          .from('collections')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching collections:', error)
          setCollections([])
        } else {
          const collections = data as Collection[] || []
          setCollections(collections)

          // Auto-select Inbox if it exists and no collections selected yet
          const inbox = collections.find(c => c.type === 'inbox')
          if (inbox && context.selectedCollections.length === 0) {
            updateContext({ selectedCollections: [inbox.id] })
          }
        }
      } catch (error) {
        console.error('Error loading collections:', error)
        setCollections([])
      } finally {
        setCollectionsLoading(false)
      }
    }

    loadCollections()
  }, [user]) // Re-run when user changes

  // Fetch recent items (only when authenticated)
  useEffect(() => {
    if (user) {
      fetchRecentItems()
    } else {
      setRecentItemsLoading(false)
    }
  }, [user])

  async function fetchRecentItems() {
    try {
      const response = await fetch('/api/items/recent?limit=5')
      const data = await response.json()

      if (data.success && data.data) {
        setRecentItems(data.data)
      }
    } catch (error) {
      console.error('Error fetching recent items:', error)
    } finally {
      setRecentItemsLoading(false)
    }
  }

  // Validation: Check if save is allowed
  const canSave =
    context.notes.trim().length > 0 || context.selectedCollections.length > 0

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

  // Not authenticated: Show sign-in prompt
  if (!user) {
    return <SignInView urlParam={urlParam} />
  }

  // Idle state: No URL provided (manual entry) - show manual entry form
  // This catches the "No URL provided" error state and shows the manual entry form instead
  if (!urlParam && user) {
    if (state.stage === 'error' && state.error === 'No URL provided') {
      return <ManualEntryView user={user} />
    }
  }

  // Render different stages
  if (state.stage === 'complete') {
    return <SuccessView item={state.item} collections={state.collections} onAddAnother={reset} />
  }

  if (state.stage === 'error') {
    return <ErrorView error={state.error} canRetry={state.canRetry} onRetry={retry} onReset={reset} />
  }

  // Capturing or Saving state: Show Context-First flow
  const isSaving = state.stage === 'saving'
  const isCapturing = state.stage === 'capturing'
  const extractionComplete = isCapturing && state.extraction.status === 'complete'

  return (
    <main className="flex min-h-screen flex-col p-6 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Add to Trove
          </h1>
        </div>

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
        />

        {/* Extracted Item Card */}
        {isCapturing && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Extracted Item
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
          onSave={triggerSave}
          onCancel={reset}
        />

        {/* Recently Troved */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <RecentlyTroved
            items={recentItems}
            loading={recentItemsLoading}
          />
        </div>
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
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
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
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Success header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Added to Trove
          </h2>
          {collections.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Saved to {collections.length} collection{collections.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Item preview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          {item.image_url && (
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-48 object-contain mb-4 rounded"
            />
          )}

          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
            {item.title}
          </h3>

          {item.brand && (
            <p className="text-gray-600 dark:text-gray-400 mb-2">{item.brand}</p>
          )}

          {item.price && item.currency && (
            <p className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100 font-mono">
              {item.currency === 'USD' && '$'}
              {item.price.toLocaleString()}
              {item.currency !== 'USD' && ` ${item.currency}`}
            </p>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={onAddAnother}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
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
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          Could not add item
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>

        <div className="space-y-3">
          {canRetry && (
            <button
              onClick={onRetry}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Retry
            </button>
          )}

          <button
            onClick={onReset}
            className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </main>
  )
}

// Manual Entry View Component
function ManualEntryView({ user }: { user: any }) {
  const [url, setUrl] = useState('')
  const [isValid, setIsValid] = useState(true)

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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            Add to Trove
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter a URL to extract and save
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              className={`w-full px-4 py-3 rounded-lg border ${
                isValid
                  ? 'border-gray-300 dark:border-gray-600'
                  : 'border-red-500 dark:border-red-500'
              } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              autoFocus
            />
            {!isValid && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                Please enter a valid URL
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!url.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Extract & Save
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
            Tip: Use the iOS Share Sheet shortcut for faster capturing
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
            Signed in as {user.email}
          </p>
        </div>
      </div>
    </main>
  )
}

// Sign In View Component
function SignInView({ urlParam }: { urlParam: string | null }) {
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async () => {
    try {
      setSigningIn(true)

      // Preserve the current URL (including query params) for redirect
      const currentUrl = window.location.href

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: currentUrl
        }
      })

      if (error) {
        console.error('Sign in error:', error)
        alert('Failed to sign in. Please try again.')
        setSigningIn(false)
      }
    } catch (error) {
      console.error('Sign in error:', error)
      alert('Failed to sign in. Please try again.')
      setSigningIn(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Sign in to Save
        </h1>

        {urlParam && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Ready to save:
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 font-mono truncate">
              {urlParam}
            </p>
          </div>
        )}

        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Sign in with Google to save items to your Trove collections.
        </p>

        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {signingIn ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Redirecting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          After signing in, you'll return to this page and your capture will automatically resume.
        </p>
      </div>
    </main>
  )
}
