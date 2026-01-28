interface SourceUrlBadgeProps {
  url: string
}

/**
 * Display source URL in pill format
 * Shows domain.com/path... (truncated for mobile)
 */
export function SourceUrlBadge({ url }: SourceUrlBadgeProps) {
  // Extract domain and path for display
  const formatUrl = (fullUrl: string): string => {
    try {
      const urlObj = new URL(fullUrl)
      const domain = urlObj.hostname.replace('www.', '')
      const path = urlObj.pathname

      // Truncate path if too long (mobile-friendly)
      const maxLength = 30
      const display = domain + path

      if (display.length > maxLength) {
        return display.substring(0, maxLength) + '...'
      }

      return display
    } catch {
      // Fallback for invalid URLs
      return fullUrl.length > 40 ? fullUrl.substring(0, 40) + '...' : fullUrl
    }
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs text-slate-500 font-mono font-medium">
        Source:
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:border-open-green transition-colors"
      >
        {formatUrl(url)}
      </a>
    </div>
  )
}
