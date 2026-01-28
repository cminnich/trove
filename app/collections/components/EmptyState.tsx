import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-6 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-xl font-mono font-semibold text-white mb-2 tracking-wide">
        {title}
      </h2>
      <p className="text-slate-400 font-mono text-sm mb-6 max-w-md">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-open-green hover:bg-emerald-400 text-void rounded-lg font-mono font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
