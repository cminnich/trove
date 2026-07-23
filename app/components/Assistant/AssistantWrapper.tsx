'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Terminal } from 'lucide-react'
import { getClient } from '@/lib/supabase-client'
import { AssistantPanel } from './AssistantPanel'

/**
 * Mounts the Trove Assistant globally: a floating toggle button (hidden on the
 * homepage and auth pages, and for signed-out users) plus the chat panel.
 */
export function AssistantWrapper() {
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const supabase = getClient()
    let cancelled = false

    // The assistant is per-user opt-in (profiles.assistant_enabled) — hide the
    // button entirely for users it isn't enabled for. The API enforces the
    // same gate server-side.
    const checkAccess = async (userId: string | undefined) => {
      if (!userId) {
        if (!cancelled) setEnabled(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('assistant_enabled')
        .eq('id', userId)
        .single()
      if (!cancelled) {
        setEnabled(!!(data as { assistant_enabled?: boolean } | null)?.assistant_enabled)
      }
    }

    supabase.auth.getUser().then(({ data }) => checkAccess(data.user?.id))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAccess(session?.user?.id)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  if (!enabled || pathname === '/' || pathname.startsWith('/auth')) {
    return null
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Trove Assistant"
          className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[60] flex items-center justify-center w-12 h-12 rounded-full bg-open-green text-void shadow-hard hover:bg-emerald-400 active:scale-95 transition-transform"
        >
          <Terminal className="w-5 h-5" />
        </button>
      )}
      {open && <AssistantPanel onClose={() => setOpen(false)} />}
    </>
  )
}
