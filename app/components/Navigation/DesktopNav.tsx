'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { name: 'Collections', href: '/collections' },
  { name: 'Add Item', href: '/add' },
  { name: 'Settings', href: '/settings' },
]

export function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav
      className="hidden md:flex sticky top-0 z-50 bg-void/95 backdrop-blur-md border-b border-slate-800"
      aria-label="Desktop navigation"
    >
      <div className="max-w-7xl mx-auto w-full px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="font-mono text-xl font-bold tracking-widest uppercase text-open-green">
              Open Trove
            </span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-4 py-2 rounded-md font-mono text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-open-green'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.name}
                </Link>
              )
            })}
          </div>

          {/* Spacer for balance */}
          <div className="w-10" />
        </div>
      </div>
    </nav>
  )
}
