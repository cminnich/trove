import { BottomSheet } from '@/app/components/BottomSheet'
import type { SortOption } from '@/app/hooks/useCollectionItems'
import { Check } from 'lucide-react'

interface SortSheetProps {
  open: boolean
  onClose: () => void
  currentSort: SortOption
  onSortChange: (sort: SortOption) => void
}

const sortOptions: Array<{ value: SortOption; label: string; description: string }> = [
  { value: 'position', label: 'Position', description: 'Your custom order' },
  { value: 'recent', label: 'Recently Added', description: 'Newest items first' },
  { value: 'price_asc', label: 'Price: Low to High', description: 'Cheapest items first' },
  { value: 'price_desc', label: 'Price: High to Low', description: 'Most expensive items first' },
  { value: 'category', label: 'Category', description: 'Alphabetical by category' },
]

export function SortSheet({ open, onClose, currentSort, onSortChange }: SortSheetProps) {
  const handleSortSelect = (sort: SortOption) => {
    onSortChange(sort)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Sort Items">
      <div className="space-y-2">
        {sortOptions.map((option) => {
          const isSelected = currentSort === option.value

          return (
            <button
              key={option.value}
              onClick={() => handleSortSelect(option.value)}
              className={`w-full p-4 rounded-lg text-left transition-colors ${
                isSelected
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-600 dark:border-indigo-400'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}
