import { ExternalLink } from "lucide-react"
import { formatUrlForDisplay } from "@/lib/url-formatter"

interface ShopNowButtonProps {
  sourceUrl: string
  retailer?: string | null
  className?: string
}

export function ShopNowButton({ sourceUrl, retailer, className = "" }: ShopNowButtonProps) {
  const buttonText = retailer
    ? `Shop at ${retailer}`
    : `Visit ${formatUrlForDisplay(sourceUrl, 30)}`

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`w-full flex items-center justify-between px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors ${className}`}
      aria-label={`Open product page at ${retailer || new URL(sourceUrl).hostname}`}
    >
      <span>{buttonText}</span>
      <ExternalLink className="w-4 h-4 flex-shrink-0" />
    </a>
  )
}
