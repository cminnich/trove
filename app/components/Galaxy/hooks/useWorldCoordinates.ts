import { useCallback, useMemo } from 'react'
import { type Vec2, type ViewTransform } from '@/types/meditative-capture'

/**
 * World Coordinate System
 *
 * The Galaxy uses a unified "world space" where:
 * - (0, 0) is the center of the canvas
 * - Positive X goes right, positive Y goes down
 * - All positions (nebulae, seed, edges) are stored in world coordinates
 * - The viewTransform (pan/zoom) is applied uniformly to both SVG and DOM layers
 *
 * This ensures SVG paths and DOM nodes always align perfectly.
 */

export interface WorldCoordinatesConfig {
  /** The view transform (pan/zoom state) */
  viewTransform: ViewTransform
  /** The container element for measuring viewport size */
  containerRef: React.RefObject<HTMLElement | null>
}

export interface WorldCoordinates {
  /**
   * Convert a screen position (e.g., mouse event) to world coordinates
   * Accounts for pan, zoom, and container offset
   */
  screenToWorld: (screenPos: Vec2) => Vec2

  /**
   * Convert a world position to screen coordinates
   * Useful for positioning overlays or checking viewport visibility
   */
  worldToScreen: (worldPos: Vec2) => Vec2

  /**
   * Get CSS transform string for positioning an element at world coordinates
   * This should be used instead of left/top for proper alignment
   */
  getTransformForPosition: (worldPos: Vec2) => string

  /**
   * Get the viewBox string for SVG that matches the current view
   * Uses the same coordinate system as DOM elements
   */
  getSvgViewBox: () => string

  /**
   * Get the CSS transform for the world layer (applies pan/zoom)
   */
  getWorldLayerTransform: () => string

  /**
   * Check if a world position is visible in the current viewport
   */
  isInViewport: (worldPos: Vec2, margin?: number) => boolean

  /**
   * Get the visible world bounds based on current viewport and zoom
   */
  getVisibleBounds: () => { minX: number; maxX: number; minY: number; maxY: number }
}

/**
 * Hook for managing unified world coordinates in the Galaxy view
 *
 * Usage:
 * ```tsx
 * const { getTransformForPosition, screenToWorld } = useWorldCoordinates({
 *   viewTransform: galaxy.viewTransform,
 *   containerRef,
 * })
 *
 * // Position a nebula
 * <div style={{ transform: getTransformForPosition(nebula.position) }} />
 *
 * // Handle click
 * const worldPos = screenToWorld({ x: event.clientX, y: event.clientY })
 * ```
 */
export function useWorldCoordinates({
  viewTransform,
  containerRef,
}: WorldCoordinatesConfig): WorldCoordinates {

  const getContainerCenter = useCallback((): Vec2 => {
    if (!containerRef.current) {
      return { x: 0, y: 0 }
    }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: rect.width / 2,
      y: rect.height / 2,
    }
  }, [containerRef])

  const screenToWorld = useCallback((screenPos: Vec2): Vec2 => {
    if (!containerRef.current) {
      return screenPos
    }

    const rect = containerRef.current.getBoundingClientRect()
    const center = getContainerCenter()

    // Convert screen coords to container-relative coords
    const containerX = screenPos.x - rect.left
    const containerY = screenPos.y - rect.top

    // Remove pan offset and center offset, then apply inverse scale
    const worldX = (containerX - center.x - viewTransform.x) / viewTransform.scale
    const worldY = (containerY - center.y - viewTransform.y) / viewTransform.scale

    return { x: worldX, y: worldY }
  }, [containerRef, viewTransform, getContainerCenter])

  const worldToScreen = useCallback((worldPos: Vec2): Vec2 => {
    if (!containerRef.current) {
      return worldPos
    }

    const rect = containerRef.current.getBoundingClientRect()
    const center = getContainerCenter()

    // Apply scale, then add pan offset and center offset, then container offset
    const screenX = worldPos.x * viewTransform.scale + center.x + viewTransform.x + rect.left
    const screenY = worldPos.y * viewTransform.scale + center.y + viewTransform.y + rect.top

    return { x: screenX, y: screenY }
  }, [containerRef, viewTransform, getContainerCenter])

  const getTransformForPosition = useCallback((worldPos: Vec2): string => {
    // Position element at world coordinates using translate
    // The parent layer handles the pan/zoom transform
    return `translate(${worldPos.x}px, ${worldPos.y}px)`
  }, [])

  const getSvgViewBox = useCallback((): string => {
    // SVG viewBox should match the world coordinate range we want to display
    // We use a large fixed viewBox and let CSS handle scaling
    // The key is that the viewBox center (0,0) matches our world center
    const size = 2000 // Total world size
    const halfSize = size / 2
    return `-${halfSize} -${halfSize} ${size} ${size}`
  }, [])

  const getWorldLayerTransform = useCallback((): string => {
    // This transform is applied to the world container (both SVG and DOM nodes)
    // It handles panning and zooming while keeping (0,0) at the visual center
    return `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`
  }, [viewTransform])

  const getVisibleBounds = useCallback(() => {
    if (!containerRef.current) {
      return { minX: -500, maxX: 500, minY: -500, maxY: 500 }
    }

    const rect = containerRef.current.getBoundingClientRect()
    const halfWidth = (rect.width / 2) / viewTransform.scale
    const halfHeight = (rect.height / 2) / viewTransform.scale

    // Account for pan offset
    const centerX = -viewTransform.x / viewTransform.scale
    const centerY = -viewTransform.y / viewTransform.scale

    return {
      minX: centerX - halfWidth,
      maxX: centerX + halfWidth,
      minY: centerY - halfHeight,
      maxY: centerY + halfHeight,
    }
  }, [containerRef, viewTransform])

  const isInViewport = useCallback((worldPos: Vec2, margin = 100): boolean => {
    const bounds = getVisibleBounds()
    return (
      worldPos.x >= bounds.minX - margin &&
      worldPos.x <= bounds.maxX + margin &&
      worldPos.y >= bounds.minY - margin &&
      worldPos.y <= bounds.maxY + margin
    )
  }, [getVisibleBounds])

  return useMemo(() => ({
    screenToWorld,
    worldToScreen,
    getTransformForPosition,
    getSvgViewBox,
    getWorldLayerTransform,
    isInViewport,
    getVisibleBounds,
  }), [
    screenToWorld,
    worldToScreen,
    getTransformForPosition,
    getSvgViewBox,
    getWorldLayerTransform,
    isInViewport,
    getVisibleBounds,
  ])
}

export default useWorldCoordinates
