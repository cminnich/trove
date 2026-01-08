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
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
