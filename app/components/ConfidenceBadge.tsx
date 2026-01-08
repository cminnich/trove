interface ConfidenceBadgeProps {
  score?: number
  needsReview: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function ConfidenceBadge({ score, needsReview, size = 'md' }: ConfidenceBadgeProps) {
  if (!needsReview) return null

  const sizeClasses = {
    sm: 'p-2 text-xs',
    md: 'p-3 text-sm',
    lg: 'p-4 text-base',
  }

  return (
    <div
      className={`${sizeClasses[size]} bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg`}
      role="alert"
      aria-label={`Low confidence extraction${score ? `: ${Math.round(score * 100)}%` : ''}`}
    >
      <p className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
        <span className="text-base">⚠️</span>
        <span>
          <strong>Review needed:</strong> Low confidence extraction.
          {score && (
            <span className="ml-1 font-mono">({Math.round(score * 100)}%)</span>
          )}
        </span>
      </p>
    </div>
  )
}
