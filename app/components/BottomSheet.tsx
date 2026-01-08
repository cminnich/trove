'use client'

import { useEffect, useRef, ReactNode } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
}

export function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number>(0)
  const currentYRef = useRef<number>(0)

  useEffect(() => {
    if (open) {
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden'

      // Focus trap - focus first focusable element
      const firstFocusable = sheetRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    currentYRef.current = 0
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY
    const deltaY = currentY - startYRef.current

    // Only allow downward swipes
    if (deltaY > 0) {
      currentYRef.current = deltaY
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${deltaY}px)`
      }
    }
  }

  const handleTouchEnd = () => {
    const threshold = 100 // px to trigger close

    if (currentYRef.current > threshold) {
      onClose()
    }

    // Reset transform
    if (sheetRef.current) {
      sheetRef.current.style.transform = ''
    }
    currentYRef.current = 0
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose()
    }
  }

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      onClose()
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open])

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center animate-fade-in"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={sheetRef}
        className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-t-2xl md:rounded-2xl shadow-2xl transition-transform duration-300 ease-out max-h-[90vh] md:max-h-[80vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle - mobile only */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          {title && (
            <h2 id="sheet-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
