'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase-client'
import { User } from '@supabase/supabase-js'
import { Settings, User as UserIcon, Globe, Lock, Bug, LogOut, Loader2, Shield, AtSign, Link2, Github } from 'lucide-react'

type Section = 'identity' | 'privacy' | 'account' | 'debug'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('identity')

  // Identity state
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  const [socialReddit, setSocialReddit] = useState('')
  const [socialX, setSocialX] = useState('')
  const [socialGithub, setSocialGithub] = useState('')
  const [identityLoading, setIdentityLoading] = useState(true)
  const [isUpdatingIdentity, setIsUpdatingIdentity] = useState(false)
  const [identityError, setIdentityError] = useState('')
  const [identitySuccess, setIdentitySuccess] = useState(false)
  const [hasIdentityChanges, setHasIdentityChanges] = useState(false)

  // Privacy state
  const [defaultVisibility, setDefaultVisibility] = useState<'public' | 'private'>('public')
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false)
  const [preferencesLoading, setPreferencesLoading] = useState(true)

  // Track original values for change detection
  const [originalIdentity, setOriginalIdentity] = useState({
    username: '',
    bio: '',
    website: '',
    socialReddit: '',
    socialX: '',
    socialGithub: '',
  })

  // Check for identity changes
  useEffect(() => {
    const changed =
      username !== originalIdentity.username ||
      bio !== originalIdentity.bio ||
      website !== originalIdentity.website ||
      socialReddit !== originalIdentity.socialReddit ||
      socialX !== originalIdentity.socialX ||
      socialGithub !== originalIdentity.socialGithub

    setHasIdentityChanges(changed)
  }, [username, bio, website, socialReddit, socialX, socialGithub, originalIdentity])

  // Check authentication and load data
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

      // Load profile identity
      try {
        const supabase = getClient()
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, bio, website, social_reddit, social_x, social_github')
          .eq('id', user.id)
          .single()

        type ProfileIdentity = {
          username: string | null
          bio: string | null
          website: string | null
          social_reddit: string | null
          social_x: string | null
          social_github: string | null
        }
        const typedProfile = profile as ProfileIdentity | null

        if (typedProfile) {
          const identity = {
            username: typedProfile.username || '',
            bio: typedProfile.bio || '',
            website: typedProfile.website || '',
            socialReddit: typedProfile.social_reddit || '',
            socialX: typedProfile.social_x || '',
            socialGithub: typedProfile.social_github || '',
          }

          setUsername(identity.username)
          setBio(identity.bio)
          setWebsite(identity.website)
          setSocialReddit(identity.socialReddit)
          setSocialX(identity.socialX)
          setSocialGithub(identity.socialGithub)
          setOriginalIdentity(identity)
        }
      } catch (error) {
        console.error('Failed to load profile:', error)
      } finally {
        setIdentityLoading(false)
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
    } finally {
      setIsUpdatingVisibility(false)
    }
  }

  const handleSaveIdentity = async () => {
    setIdentityError('')
    setIdentitySuccess(false)

    try {
      setIsUpdatingIdentity(true)

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          bio: bio,
          website: website,
          social_reddit: socialReddit,
          social_x: socialX,
          social_github: socialGithub,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setIdentityError(data.error || 'Failed to update profile')
        return
      }

      // Update original values
      setOriginalIdentity({
        username,
        bio,
        website,
        socialReddit,
        socialX,
        socialGithub,
      })
      setIdentitySuccess(true)

      // Clear success message after 3 seconds
      setTimeout(() => {
        setIdentitySuccess(false)
      }, 3000)
    } catch (error) {
      console.error('Failed to update profile:', error)
      setIdentityError(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setIsUpdatingIdentity(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-void">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-open-green animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-mono text-sm">Loading settings...</p>
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
    <main className="min-h-screen bg-void pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-open-green" />
            <h1 className="text-3xl font-mono font-bold text-white tracking-wide">
              SETTINGS
            </h1>
          </div>
          <p className="text-slate-400 font-mono text-sm">
            // Manage your profile and account
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Vertical Navigation */}
          <nav className="md:w-64 flex-shrink-0">
            <div className="bg-slate-deep border border-slate-800 rounded-lg p-2 shadow-hard">
              <button
                onClick={() => setActiveSection('identity')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-mono text-sm ${
                  activeSection === 'identity'
                    ? 'bg-slate-800 text-open-green'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <UserIcon className="w-5 h-5" />
                <span className="font-medium">Identity</span>
              </button>

              <button
                onClick={() => setActiveSection('privacy')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-mono text-sm ${
                  activeSection === 'privacy'
                    ? 'bg-slate-800 text-open-green'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Shield className="w-5 h-5" />
                <span className="font-medium">Privacy</span>
              </button>

              <button
                onClick={() => setActiveSection('account')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-mono text-sm ${
                  activeSection === 'account'
                    ? 'bg-slate-800 text-open-green'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Lock className="w-5 h-5" />
                <span className="font-medium">Account</span>
              </button>

              <button
                onClick={() => setActiveSection('debug')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-mono text-sm ${
                  activeSection === 'debug'
                    ? 'bg-slate-800 text-open-green'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Bug className="w-5 h-5" />
                <span className="font-medium">Debug</span>
              </button>
            </div>
          </nav>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-slate-deep border border-slate-800 rounded-lg p-6 md:p-8 shadow-hard">
              {/* Identity Section */}
              {activeSection === 'identity' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-mono font-bold text-white mb-2">IDENTITY</h2>
                    <p className="text-slate-400 font-mono text-sm">// Build your public profile</p>
                  </div>

                  {identityLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-open-green animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Avatar (placeholder) */}
                      <div className="bg-void border border-slate-800 rounded-lg p-4">
                        <label className="block text-sm font-mono font-medium text-slate-300 mb-3">
                          Avatar
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-open-green rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-void font-mono font-bold text-2xl">
                              {user.email?.[0].toUpperCase() || '?'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 font-mono">
                            // Custom avatars coming soon
                          </p>
                        </div>
                      </div>

                      {/* Username */}
                      <div className="bg-void border border-slate-800 rounded-lg p-4">
                        <label className="block text-sm font-mono font-medium text-slate-300 mb-2">
                          Username
                        </label>
                        <div className="flex items-center gap-2 bg-slate-deep border border-slate-800 rounded-lg px-3 py-2">
                          <AtSign className="w-5 h-5 text-slate-500" />
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => {
                              setUsername(e.target.value)
                              setIdentityError('')
                              setIdentitySuccess(false)
                            }}
                            placeholder="your_username"
                            className="flex-1 bg-transparent text-white font-mono focus:outline-none"
                          />
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          3-20 characters, letters, numbers, and underscores
                        </p>
                      </div>

                      {/* Bio */}
                      <div className="bg-void border border-slate-800 rounded-lg p-4">
                        <label className="block text-sm font-mono font-medium text-slate-300 mb-2">
                          Bio
                        </label>
                        <textarea
                          value={bio}
                          onChange={(e) => {
                            setBio(e.target.value)
                            setIdentityError('')
                            setIdentitySuccess(false)
                          }}
                          placeholder="e.g. Caffeine Addict. Watch Enthusiast. Hacker."
                          rows={2}
                          maxLength={160}
                          className="w-full px-4 py-2 bg-slate-deep border border-slate-800 rounded-lg text-white font-mono focus:ring-2 focus:ring-open-green focus:border-transparent resize-none"
                        />
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          {bio.length}/160 characters
                        </p>
                      </div>

                      {/* Website */}
                      <div className="bg-void border border-slate-800 rounded-lg p-4">
                        <label className="block text-sm font-mono font-medium text-slate-300 mb-2">
                          Website
                        </label>
                        <div className="flex items-center gap-2 bg-slate-deep border border-slate-800 rounded-lg px-3 py-2">
                          <Link2 className="w-5 h-5 text-slate-500" />
                          <input
                            type="url"
                            value={website}
                            onChange={(e) => {
                              setWebsite(e.target.value)
                              setIdentityError('')
                              setIdentitySuccess(false)
                            }}
                            placeholder="https://yoursite.com"
                            className="flex-1 bg-transparent text-white font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Social Links */}
                      <div className="bg-void border border-slate-800 rounded-lg p-4">
                        <label className="block text-sm font-mono font-medium text-slate-300 mb-3">
                          Social Links
                        </label>
                        <div className="space-y-3">
                          {/* Reddit */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 flex-1 bg-slate-deep border border-slate-800 rounded-lg px-3 py-2">
                              <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                              </svg>
                              <span className="text-slate-500 font-mono">u/</span>
                              <input
                                type="text"
                                value={socialReddit}
                                onChange={(e) => {
                                  setSocialReddit(e.target.value)
                                  setIdentityError('')
                                  setIdentitySuccess(false)
                                }}
                                placeholder="username"
                                className="flex-1 bg-transparent text-white font-mono focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* X/Twitter */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 flex-1 bg-slate-deep border border-slate-800 rounded-lg px-3 py-2">
                              <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                              </svg>
                              <span className="text-slate-500 font-mono">@</span>
                              <input
                                type="text"
                                value={socialX}
                                onChange={(e) => {
                                  setSocialX(e.target.value)
                                  setIdentityError('')
                                  setIdentitySuccess(false)
                                }}
                                placeholder="username"
                                className="flex-1 bg-transparent text-white font-mono focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* GitHub */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 flex-1 bg-slate-deep border border-slate-800 rounded-lg px-3 py-2">
                              <Github className="w-5 h-5 text-slate-500" />
                              <span className="text-slate-500 font-mono">github.com/</span>
                              <input
                                type="text"
                                value={socialGithub}
                                onChange={(e) => {
                                  setSocialGithub(e.target.value)
                                  setIdentityError('')
                                  setIdentitySuccess(false)
                                }}
                                placeholder="username"
                                className="flex-1 bg-transparent text-white font-mono focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-2">
                          // Link your social profiles for community trust
                        </p>
                      </div>

                      {/* Save Button */}
                      {hasIdentityChanges && (
                        <div className="pt-4 border-t border-slate-800">
                          <button
                            onClick={handleSaveIdentity}
                            disabled={isUpdatingIdentity}
                            className="flex items-center gap-2 px-6 py-3 bg-open-green hover:bg-emerald-400 disabled:bg-slate-700 disabled:opacity-50 text-void font-mono font-bold rounded-lg transition-colors"
                          >
                            {isUpdatingIdentity ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <span>Save Changes</span>
                            )}
                          </button>
                        </div>
                      )}

                      {identityError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <p className="text-sm text-red-400 font-mono">
                            {identityError}
                          </p>
                        </div>
                      )}

                      {identitySuccess && (
                        <div className="p-3 bg-open-green/10 border border-open-green/20 rounded-lg">
                          <p className="text-sm text-open-green font-mono">
                            Profile updated successfully!
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Privacy Section */}
              {activeSection === 'privacy' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-mono font-bold text-white mb-2">PRIVACY</h2>
                    <p className="text-slate-400 font-mono text-sm">// Control your data and visibility</p>
                  </div>

                  {preferencesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-open-green animate-spin" />
                    </div>
                  ) : (
                    <div className="bg-void border border-slate-800 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {defaultVisibility === 'public' ? (
                              <Globe className="w-4 h-4 text-open-green" />
                            ) : (
                              <Lock className="w-4 h-4 text-amber-400" />
                            )}
                            <label className="block text-sm font-mono font-medium text-white">
                              {defaultVisibility === 'public' ? 'Public by Default' : 'Privacy Mode Enabled'}
                            </label>
                          </div>
                          <p className="text-sm text-slate-400 font-mono">
                            {defaultVisibility === 'public'
                              ? 'New collections are public and can use AI features like smart descriptions and insights'
                              : 'New collections are private. AI features are disabled for privacy.'}
                          </p>
                          {defaultVisibility === 'private' && (
                            <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300 font-mono">
                              <strong>Note:</strong> Privacy mode disables AI-powered features like collection overviews and smart recommendations.
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleVisibilityToggle}
                          disabled={isUpdatingVisibility}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${
                            defaultVisibility === 'public' ? 'bg-open-green' : 'bg-amber-600'
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
                  )}
                </div>
              )}

              {/* Account Section */}
              {activeSection === 'account' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-mono font-bold text-white mb-2">ACCOUNT</h2>
                    <p className="text-slate-400 font-mono text-sm">// Manage your account settings</p>
                  </div>

                  {/* User Info */}
                  <div className="bg-void border border-slate-800 rounded-lg p-4">
                    <label className="block text-sm font-mono font-medium text-slate-300 mb-2">
                      Email Address
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-open-green rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-void font-mono font-bold text-lg">
                          {user.email?.[0].toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-mono">{user.email}</p>
                        <p className="text-sm text-slate-500 font-mono">via {user.app_metadata.provider || 'email'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-void border border-slate-800 rounded-lg p-4">
                    <label className="block text-sm font-mono font-medium text-slate-300 mb-2">
                      User ID
                    </label>
                    <code className="block text-xs text-open-green font-mono bg-slate-deep px-3 py-2 rounded border border-slate-800">
                      {user.id}
                    </code>
                  </div>

                  {/* Sign Out Button */}
                  <div className="pt-4 border-t border-slate-800">
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:opacity-50 text-white font-mono font-medium rounded-lg transition-colors"
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

              {/* Debug Section */}
              {activeSection === 'debug' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-mono font-bold text-white mb-2">DEBUG</h2>
                    <p className="text-slate-400 font-mono text-sm">// Technical information about your deployment</p>
                  </div>

                  {/* Deployment Version */}
                  <div className="bg-void border border-slate-800 rounded-lg p-4">
                    <label className="block text-sm font-mono font-medium text-slate-300 mb-2">
                      Deployment Version
                    </label>
                    <code className="block text-sm text-open-green font-mono bg-slate-deep px-4 py-3 rounded border border-slate-800">
                      {deploymentVersion}
                    </code>
                    <p className="text-xs text-slate-500 font-mono mt-2">
                      Git commit SHA (first 7 characters)
                    </p>
                  </div>

                  {/* Build Timestamp */}
                  <div className="bg-void border border-slate-800 rounded-lg p-4">
                    <label className="block text-sm font-mono font-medium text-slate-300 mb-2">
                      Last Build Timestamp
                    </label>
                    <code className="block text-sm text-open-green font-mono bg-slate-deep px-4 py-3 rounded border border-slate-800">
                      {new Date(buildTimestamp).toLocaleString()}
                    </code>
                    <p className="text-xs text-slate-500 font-mono mt-2">
                      ISO 8601 format: {buildTimestamp}
                    </p>
                  </div>

                  {/* Environment Info */}
                  <div className="bg-void border border-slate-800 rounded-lg p-4">
                    <label className="block text-sm font-mono font-medium text-slate-300 mb-2">
                      Environment
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-slate-400">Node Environment:</span>
                        <code className="text-open-green">
                          {process.env.NODE_ENV || 'production'}
                        </code>
                      </div>
                      <div className="flex items-center justify-between text-sm font-mono">
                        <span className="text-slate-400">Vercel Deployment:</span>
                        <code className="text-open-green">
                          {process.env.NEXT_PUBLIC_VERCEL_ENV || 'false'}
                        </code>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-500 font-mono italic">
                      // Debug information is useful for troubleshooting and support.
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
