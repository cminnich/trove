'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase-client'
import { User } from '@supabase/supabase-js'
import { Settings, User as UserIcon, Palette, Bug, LogOut, Loader2, Globe, Lock, Sparkles, List } from 'lucide-react'

type Section = 'account' | 'preferences' | 'debug'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('account')

  // Preferences state
  const [darkMode, setDarkMode] = useState(false)
  const [aiTone, setAiTone] = useState('technical')
  const [defaultVisibility, setDefaultVisibility] = useState<'public' | 'private'>('public')
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false)
  const [preferencesLoading, setPreferencesLoading] = useState(true)

  // Galaxy View feature flag (stored in localStorage)
  const [galaxyViewEnabled, setGalaxyViewEnabled] = useState(true)

  // Load Galaxy View preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('trove:galaxyViewEnabled')
      if (stored !== null) {
        setGalaxyViewEnabled(stored === 'true')
      }
    }
  }, [])

  // Save Galaxy View preference to localStorage
  const handleGalaxyViewToggle = () => {
    const newValue = !galaxyViewEnabled
    setGalaxyViewEnabled(newValue)
    if (typeof window !== 'undefined') {
      localStorage.setItem('trove:galaxyViewEnabled', String(newValue))
      // Dispatch a custom event so other components can react
      window.dispatchEvent(new CustomEvent('trove:galaxyViewChanged', { detail: newValue }))
    }
  }

  // Check authentication and load preferences
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login?next=/settings')
        return
      }

      setUser(user)
      setLoading(false)

      // Load user preferences
      try {
        const response = await fetch('/api/user/preferences')
        const data = await response.json()

        if (data.success && data.data) {
          setDefaultVisibility(data.data.default_visibility)
        }
      } catch (error) {
        console.error('Failed to load preferences:', error)
      } finally {
        setPreferencesLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      const supabase = getClient()
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Sign out error:', error)
      setSigningOut(false)
    }
  }

  const handleVisibilityToggle = async () => {
    const newVisibility = defaultVisibility === 'public' ? 'private' : 'public'

    try {
      setIsUpdatingVisibility(true)

      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          default_visibility: newVisibility,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update preference')
      }

      setDefaultVisibility(newVisibility)
    } catch (error) {
      console.error('Failed to update visibility preference:', error)
      // Optionally show error toast here
    } finally {
      setIsUpdatingVisibility(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading settings...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return null
  }

  // Build timestamp (fallback to current date)
  const buildTimestamp = new Date().toISOString()
  const deploymentVersion = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev-local'

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-indigo-400" />
            <h1 className="text-3xl font-bold text-white">
              Settings
            </h1>
          </div>
          <p className="text-slate-400">
            Manage your account and preferences
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Vertical Navigation */}
          <nav className="md:w-64 flex-shrink-0">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-2 shadow-xl">
              <button
                onClick={() => setActiveSection('account')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeSection === 'account'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <UserIcon className="w-5 h-5" />
                <span className="font-medium">Account</span>
              </button>

              <button
                onClick={() => setActiveSection('preferences')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeSection === 'preferences'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <Palette className="w-5 h-5" />
                <span className="font-medium">Preferences</span>
              </button>

              <button
                onClick={() => setActiveSection('debug')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeSection === 'debug'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <Bug className="w-5 h-5" />
                <span className="font-medium">Debug</span>
              </button>
            </div>
          </nav>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 md:p-8 shadow-xl">
              {/* Account Section */}
              {activeSection === 'account' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Account</h2>
                    <p className="text-slate-400">Manage your account information and authentication</p>
                  </div>

                  {/* User Info */}
                  <div className="space-y-4">
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Email Address
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-lg">
                            {user.email?.[0].toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.email}</p>
                          <p className="text-sm text-slate-400">Logged in via {user.app_metadata.provider || 'email'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        User ID
                      </label>
                      <code className="block text-xs text-indigo-300 font-mono bg-slate-950 px-3 py-2 rounded border border-slate-700">
                        {user.id}
                      </code>
                    </div>
                  </div>

                  {/* Sign Out Button */}
                  <div className="pt-4 border-t border-slate-700/50">
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                    >
                      {signingOut ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Signing out...</span>
                        </>
                      ) : (
                        <>
                          <LogOut className="w-5 h-5" />
                          <span>Sign Out</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Preferences Section */}
              {activeSection === 'preferences' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Preferences</h2>
                    <p className="text-slate-400">Customize your Trove experience</p>
                  </div>

                  {preferencesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Default Visibility */}
                      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {defaultVisibility === 'public' ? (
                                <Globe className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Lock className="w-4 h-4 text-amber-400" />
                              )}
                              <label className="block text-sm font-medium text-white">
                                {defaultVisibility === 'public' ? 'Public by Default' : 'Privacy Mode Enabled'}
                              </label>
                            </div>
                            <p className="text-sm text-slate-400 mb-2">
                              {defaultVisibility === 'public'
                                ? 'New collections are public and can use AI features like smart descriptions and insights'
                                : 'New collections are private. AI features are disabled for privacy.'}
                            </p>
                            {defaultVisibility === 'private' && (
                              <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300">
                                <strong>Note:</strong> Privacy mode disables AI-powered features like collection overviews and smart recommendations.
                              </div>
                            )}
                          </div>
                          <button
                            onClick={handleVisibilityToggle}
                            disabled={isUpdatingVisibility}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${
                              defaultVisibility === 'public' ? 'bg-emerald-600' : 'bg-amber-600'
                            } ${isUpdatingVisibility ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isUpdatingVisibility ? (
                              <Loader2 className="w-4 h-4 text-white mx-auto animate-spin" />
                            ) : (
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                  defaultVisibility === 'public' ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Appearance */}
                      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-sm font-medium text-white mb-1">
                              Appearance
                            </label>
                            <p className="text-sm text-slate-400">Toggle between light and dark mode</p>
                          </div>
                          <button
                            onClick={() => setDarkMode(!darkMode)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                              darkMode ? 'bg-indigo-600' : 'bg-slate-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                darkMode ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        {darkMode && (
                          <div className="mt-2 text-xs text-indigo-300">
                            Dark mode enabled (UI preview)
                          </div>
                        )}
                      </div>

                      {/* AI Tone */}
                      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                        <label className="block text-sm font-medium text-white mb-2">
                          AI Tone
                        </label>
                        <p className="text-sm text-slate-400 mb-3">Select the tone for AI-generated descriptions</p>
                        <select
                          value={aiTone}
                          onChange={(e) => setAiTone(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value="concise">Concise</option>
                          <option value="technical">Technical</option>
                          <option value="creative">Creative</option>
                        </select>
                      </div>

                      {/* Galaxy View Toggle */}
                      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {galaxyViewEnabled ? (
                                <Sparkles className="w-4 h-4 text-purple-400" />
                              ) : (
                                <List className="w-4 h-4 text-slate-400" />
                              )}
                              <label className="block text-sm font-medium text-white">
                                {galaxyViewEnabled ? 'Galaxy View' : 'Ledger View'}
                              </label>
                              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                                Experimental
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 mb-2">
                              {galaxyViewEnabled
                                ? 'Spatial exploration mode with an immersive Galaxy interface. Collections appear as nebulae.'
                                : 'Classic list/grid view for utility-first browsing. Familiar table-based interface.'}
                            </p>
                          </div>
                          <button
                            onClick={handleGalaxyViewToggle}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${
                              galaxyViewEnabled ? 'bg-purple-600' : 'bg-slate-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                galaxyViewEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-700/50">
                        <p className="text-xs text-slate-500 italic">
                          Note: Appearance and AI Tone are UI stubs and are not currently persisted. Galaxy View is stored locally.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Debug Section */}
              {activeSection === 'debug' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Debug</h2>
                    <p className="text-slate-400">Technical information about your deployment</p>
                  </div>

                  {/* Deployment Version */}
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Deployment Version
                    </label>
                    <code className="block text-sm text-emerald-300 font-mono bg-slate-950 px-4 py-3 rounded border border-slate-700">
                      {deploymentVersion}
                    </code>
                    <p className="text-xs text-slate-500 mt-2">
                      Git commit SHA (first 7 characters)
                    </p>
                  </div>

                  {/* Build Timestamp */}
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Last Build Timestamp
                    </label>
                    <code className="block text-sm text-emerald-300 font-mono bg-slate-950 px-4 py-3 rounded border border-slate-700">
                      {new Date(buildTimestamp).toLocaleString()}
                    </code>
                    <p className="text-xs text-slate-500 mt-2">
                      ISO 8601 format: {buildTimestamp}
                    </p>
                  </div>

                  {/* Environment Info */}
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Environment
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Node Environment:</span>
                        <code className="text-emerald-300 font-mono">
                          {process.env.NODE_ENV || 'production'}
                        </code>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Vercel Deployment:</span>
                        <code className="text-emerald-300 font-mono">
                          {process.env.NEXT_PUBLIC_VERCEL_ENV || 'false'}
                        </code>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500 italic">
                      Debug information is useful for troubleshooting and support.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
