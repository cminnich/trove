'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Plus, Settings } from 'lucide-react'

const tabs = [
  { name: 'Collections', href: '/collections', icon: LayoutGrid },
  { name: 'Add', href: '/add', icon: Plus },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-void border-t border-slate-800"
      style={{
        height: '80px',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-full px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          const Icon = tab.icon

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-lg transition-colors ${
                isActive
                  ? 'text-open-green'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-mono font-medium">{tab.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
