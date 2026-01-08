import { LayoutGrid, List } from 'lucide-react'
import type { ViewMode } from '@/app/hooks/useViewPreference'

interface ViewToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('grid')}
        className={`p-2 rounded transition-colors ${
          viewMode === 'grid'
            ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
        }`}
        aria-label="Grid view"
        aria-pressed={viewMode === 'grid'}
      >
        <LayoutGrid className="w-5 h-5" />
      </button>
      <button
        onClick={() => onViewModeChange('list')}
        className={`p-2 rounded transition-colors ${
          viewMode === 'list'
            ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
        }`}
        aria-label="List view"
        aria-pressed={viewMode === 'list'}
      >
        <List className="w-5 h-5" />
      </button>
    </div>
  )
}
