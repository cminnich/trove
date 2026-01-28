'use client'

import { useEffect, useRef, ReactNode, useCallback } from 'react'
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
  const contentRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)

  // Touch tracking refs
  const startYRef = useRef<number>(0)
  const currentYRef = useRef<number>(0)
  const isDraggingRef = useRef<boolean>(false)
  const dragSourceRef = useRef<'handle' | 'content' | null>(null)

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

  // Check if content is scrolled to top
  const isContentAtTop = useCallback(() => {
    if (!contentRef.current) return true
    return contentRef.current.scrollTop <= 0
  }, [])

  // Handle touch start on the drag handle (always allows drag)
  const handleDragHandleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    currentYRef.current = 0
    isDraggingRef.current = true
    dragSourceRef.current = 'handle'
  }

  // Handle touch start on content (only allows drag when scrolled to top)
  const handleContentTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    currentYRef.current = 0
    // Only set as potential drag source, actual drag will be determined in move
    dragSourceRef.current = 'content'
    isDraggingRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY
    const deltaY = currentY - startYRef.current

    // If drag source is handle, always allow dragging down
    if (dragSourceRef.current === 'handle' && deltaY > 0) {
      isDraggingRef.current = true
      // Apply resistance - move at 70% of finger movement
      const resistedDelta = deltaY * 0.7
      currentYRef.current = resistedDelta
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${resistedDelta}px)`
        sheetRef.current.style.transition = 'none'
      }
      return
    }

    // If drag source is content, only allow drag when:
    // 1. Content is at top (scrollTop === 0)
    // 2. User is swiping DOWN (deltaY > 0)
    // 3. Movement exceeds a small threshold to distinguish from scroll intent (20px)
    if (dragSourceRef.current === 'content') {
      if (isContentAtTop() && deltaY > 20) {
        // User is at top and swiping down - start drag-to-dismiss
        isDraggingRef.current = true
        // Apply stronger resistance for content-initiated drags
        const resistedDelta = (deltaY - 20) * 0.6
        currentYRef.current = resistedDelta
        if (sheetRef.current) {
          sheetRef.current.style.transform = `translateY(${resistedDelta}px)`
          sheetRef.current.style.transition = 'none'
        }
        // Prevent content from scrolling while dragging
        e.preventDefault()
      }
      // If not at top or swiping up, let normal scroll happen (don't preventDefault)
    }
  }

  const handleTouchEnd = () => {
    const threshold = 120 // px to trigger close (increased for less sensitivity)

    if (isDraggingRef.current && currentYRef.current > threshold) {
      // Animate out before closing
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 200ms ease-out'
        sheetRef.current.style.transform = 'translateY(100%)'
      }
      setTimeout(() => {
        onClose()
        // Reset after close
        if (sheetRef.current) {
          sheetRef.current.style.transform = ''
          sheetRef.current.style.transition = ''
        }
      }, 200)
    } else {
      // Snap back with animation
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 200ms ease-out'
        sheetRef.current.style.transform = ''
      }
      setTimeout(() => {
        if (sheetRef.current) {
          sheetRef.current.style.transition = ''
        }
      }, 200)
    }

    // Reset refs
    currentYRef.current = 0
    isDraggingRef.current = false
    dragSourceRef.current = null
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose()
    }
  }

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      onClose()
    }
  }, [open, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 md:items-center animate-fade-in"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={sheetRef}
        className="w-full max-w-2xl bg-slate-deep border border-slate-800 rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[95vh] md:max-h-[90vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle - mobile only - this is the "safe zone" for dismissing */}
        <div
          ref={dragHandleRef}
          className="md:hidden flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleDragHandleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1.5 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          {title && (
            <h2 id="sheet-title" className="text-xl font-mono font-semibold text-white">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content - scrollable area with drag-to-dismiss only when at top */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto px-6 py-4 overscroll-contain"
          onTouchStart={handleContentTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
