'use client'

import { notFound } from 'next/navigation'
import { AssistantPanel } from '@/app/components/Assistant/AssistantPanel'

/**
 * Dev-only visual preview of the Assistant panel (no auth required — API calls
 * from the panel will 401, which is fine for layout inspection).
 * Returns 404 in production builds.
 */
export default function AssistantPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="min-h-screen bg-void">
      <AssistantPanel onClose={() => {}} />
    </div>
  )
}
