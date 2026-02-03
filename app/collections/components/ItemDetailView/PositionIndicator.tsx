'use client'

interface PositionIndicatorProps {
  currentIndex: number
  totalCount: number
  onNavigate: (index: number) => void
  maxDots?: number
}

export function PositionIndicator({
  currentIndex,
  totalCount,
  onNavigate,
  maxDots = 7,
}: PositionIndicatorProps) {
  if (totalCount <= 1) {
    return null
  }

  // Calculate which dots to show
  const { dots, startIndex } = calculateDotRange(currentIndex, totalCount, maxDots)

  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {/* Left ellipsis indicator */}
      {startIndex > 0 && (
        <button
          onClick={() => onNavigate(0)}
          className="w-1.5 h-1.5 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
          aria-label="Go to first item"
        />
      )}

      {/* Dot indicators */}
      {dots.map((index) => {
        const isActive = index === currentIndex
        const distance = Math.abs(index - currentIndex)

        // Calculate size based on distance from active dot
        let sizeClass = 'w-2 h-2'
        if (isActive) {
          sizeClass = 'w-2.5 h-2.5'
        } else if (distance === 1) {
          sizeClass = 'w-2 h-2'
        } else if (distance === 2) {
          sizeClass = 'w-1.5 h-1.5'
        } else {
          sizeClass = 'w-1 h-1'
        }

        return (
          <button
            key={index}
            onClick={() => onNavigate(index)}
            className={`
              rounded-full transition-all duration-200
              ${sizeClass}
              ${
                isActive
                  ? 'bg-indigo-500 shadow-sm'
                  : 'bg-slate-700 hover:bg-slate-600'
              }
            `}
            aria-label={`Go to item ${index + 1}`}
            aria-current={isActive ? 'true' : undefined}
          />
        )
      })}

      {/* Right ellipsis indicator */}
      {startIndex + dots.length < totalCount && (
        <button
          onClick={() => onNavigate(totalCount - 1)}
          className="w-1.5 h-1.5 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
          aria-label="Go to last item"
        />
      )}

      {/* Text indicator for accessibility */}
      <span className="sr-only">
        Item {currentIndex + 1} of {totalCount}
      </span>
    </div>
  )
}

function calculateDotRange(
  currentIndex: number,
  totalCount: number,
  maxDots: number
): { dots: number[]; startIndex: number } {
  // If total count is less than or equal to max dots, show all
  if (totalCount <= maxDots) {
    return {
      dots: Array.from({ length: totalCount }, (_, i) => i),
      startIndex: 0,
    }
  }

  // Calculate range centered on current index
  const halfRange = Math.floor(maxDots / 2)
  let startIndex = Math.max(0, currentIndex - halfRange)
  let endIndex = startIndex + maxDots

  // Adjust if we're at the end
  if (endIndex > totalCount) {
    endIndex = totalCount
    startIndex = Math.max(0, endIndex - maxDots)
  }

  const dots = Array.from({ length: endIndex - startIndex }, (_, i) => startIndex + i)

  return { dots, startIndex }
}
