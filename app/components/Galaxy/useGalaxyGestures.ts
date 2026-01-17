'use client'

import { useCallback, useRef, useState } from 'react'
import { type Vec2 } from '@/types/meditative-capture'

interface GestureState {
  isPanning: boolean
  isPinching: boolean
  panStart: Vec2 | null
  initialScale: number
  initialDistance: number
}

interface UseGalaxyGesturesOptions {
  /** Current view transform */
  transform: { x: number; y: number; scale: number }
  /** Update view transform */
  onTransformChange: (transform: { x: number; y: number; scale: number }) => void
  /** Minimum scale */
  minScale?: number
  /** Maximum scale */
  maxScale?: number
  /** Called when long press is detected */
  onLongPress?: (position: Vec2) => void
  /** Long press duration in ms */
  longPressDuration?: number
}

/**
 * useGalaxyGestures - Handle pan, pinch-zoom, and long-press gestures
 */
export function useGalaxyGestures({
  transform,
  onTransformChange,
  minScale = 0.5,
  maxScale = 3,
  onLongPress,
  longPressDuration = 1000,
}: UseGalaxyGesturesOptions) {
  const [gestureState, setGestureState] = useState<GestureState>({
    isPanning: false,
    isPinching: false,
    panStart: null,
    initialScale: 1,
    initialDistance: 0,
  })

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTouchRef = useRef<Vec2 | null>(null)

  // Get touch/mouse position relative to container
  const getPosition = useCallback((
    e: React.TouchEvent | React.MouseEvent,
    container: HTMLElement
  ): Vec2 => {
    const rect = container.getBoundingClientRect()

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }

    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    }
  }, [])

  // Get distance between two touches
  const getTouchDistance = useCallback((e: React.TouchEvent): number => {
    if (e.touches.length < 2) return 0

    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  // Cancel long press
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // Handle touch/mouse start
  const handlePointerDown = useCallback((
    e: React.TouchEvent | React.MouseEvent,
    container: HTMLElement
  ) => {
    const position = getPosition(e, container)
    lastTouchRef.current = position

    if ('touches' in e && e.touches.length === 2) {
      // Pinch start
      cancelLongPress()
      setGestureState({
        isPanning: false,
        isPinching: true,
        panStart: null,
        initialScale: transform.scale,
        initialDistance: getTouchDistance(e),
      })
    } else {
      // Pan start / potential long press
      setGestureState({
        isPanning: true,
        isPinching: false,
        panStart: position,
        initialScale: transform.scale,
        initialDistance: 0,
      })

      // Start long press timer
      if (onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          // Convert screen position to galaxy coordinates
          const galaxyPosition = {
            x: (position.x - container.offsetWidth / 2 - transform.x) / transform.scale,
            y: (position.y - container.offsetHeight / 2 - transform.y) / transform.scale,
          }
          onLongPress(galaxyPosition)
        }, longPressDuration)
      }
    }
  }, [transform, getPosition, getTouchDistance, cancelLongPress, onLongPress, longPressDuration])

  // Handle touch/mouse move
  const handlePointerMove = useCallback((
    e: React.TouchEvent | React.MouseEvent,
    container: HTMLElement
  ) => {
    const position = getPosition(e, container)

    // Cancel long press if moved too much
    if (gestureState.isPanning && gestureState.panStart) {
      const dx = position.x - gestureState.panStart.x
      const dy = position.y - gestureState.panStart.y
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        cancelLongPress()
      }
    }

    if (gestureState.isPinching && 'touches' in e && e.touches.length === 2) {
      // Handle pinch zoom
      const currentDistance = getTouchDistance(e)
      const scale = (currentDistance / gestureState.initialDistance) * gestureState.initialScale
      const clampedScale = Math.min(Math.max(scale, minScale), maxScale)

      onTransformChange({
        ...transform,
        scale: clampedScale,
      })
    } else if (gestureState.isPanning && lastTouchRef.current) {
      // Handle pan
      const dx = position.x - lastTouchRef.current.x
      const dy = position.y - lastTouchRef.current.y

      onTransformChange({
        ...transform,
        x: transform.x + dx,
        y: transform.y + dy,
      })
    }

    lastTouchRef.current = position
  }, [gestureState, transform, getPosition, getTouchDistance, cancelLongPress, minScale, maxScale, onTransformChange])

  // Handle touch/mouse end
  const handlePointerUp = useCallback(() => {
    cancelLongPress()
    setGestureState({
      isPanning: false,
      isPinching: false,
      panStart: null,
      initialScale: transform.scale,
      initialDistance: 0,
    })
    lastTouchRef.current = null
  }, [transform.scale, cancelLongPress])

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()

    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.min(Math.max(transform.scale * delta, minScale), maxScale)

    onTransformChange({
      ...transform,
      scale: newScale,
    })
  }, [transform, minScale, maxScale, onTransformChange])

  return {
    gestureState,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    cancelLongPress,
  }
}

export default useGalaxyGestures
