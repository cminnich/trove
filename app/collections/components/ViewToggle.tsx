import { LayoutGrid, List } from 'lucide-react'
import type { ViewMode } from '@/app/hooks/useViewPreference'

interface ViewToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('grid')}
        className={`p-2 rounded transition-colors ${
          viewMode === 'grid'
            ? 'bg-slate-800 text-indigo-400 shadow-sm'
            : 'text-slate-400 hover:text-white'
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
            ? 'bg-slate-800 text-indigo-400 shadow-sm'
            : 'text-slate-400 hover:text-white'
        }`}
        aria-label="List view"
        aria-pressed={viewMode === 'list'}
      >
        <List className="w-5 h-5" />
      </button>
    </div>
  )
}
