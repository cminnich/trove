'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/app/components/Logo'

const navLinks = [
  { name: 'Collections', href: '/collections' },
  { name: 'Add Item', href: '/add' },
]

export function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav
      className="hidden md:flex sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800"
      aria-label="Desktop navigation"
    >
      <div className="max-w-7xl mx-auto w-full px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Logo size={40} />
            <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Trove
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
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.name}
                </Link>
              )
            })}
          </div>

          {/* Right side - placeholder for future actions */}
          <div className="w-10" />
        </div>
      </div>
    </nav>
  )
}
