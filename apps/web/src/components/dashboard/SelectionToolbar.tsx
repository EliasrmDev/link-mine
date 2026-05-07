'use client'

import { Trash2, X, CheckSquare } from 'lucide-react'

interface Props {
  selectedBookmarks: number
  selectedFolders: number
  onDelete: () => void
  onClear: () => void
}

export function SelectionToolbar({ selectedBookmarks, selectedFolders, onDelete, onClear }: Props) {
  const total = selectedBookmarks + selectedFolders
  if (total === 0) return null

  const parts: string[] = []
  if (selectedBookmarks > 0) parts.push(`${selectedBookmarks} bookmark${selectedBookmarks !== 1 ? 's' : ''}`)
  if (selectedFolders > 0) parts.push(`${selectedFolders} folder${selectedFolders !== 1 ? 's' : ''}`)

  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2.5 shadow-xl dark:border-gray-700 dark:bg-gray-800"
    >
      <CheckSquare className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {parts.join(' + ')} selected
      </span>
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 transition-colors"
        aria-label={`Delete ${parts.join(' and ')}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Delete selected
      </button>
      <button
        onClick={onClear}
        className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
