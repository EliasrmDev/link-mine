'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  currentPage: number
  totalItems: number
  pageSize: number
  pageSizeOptions?: number[]
  className?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 30, 60],
  className = '',
  onPageChange,
  onPageSizeChange,
}: Props) {
  const isShowAll = !isFinite(pageSize)
  const totalPages = isShowAll ? 1 : Math.max(1, Math.ceil(totalItems / pageSize))
  const from = totalItems === 0 ? 0 : isShowAll ? 1 : (currentPage - 1) * pageSize + 1
  const to = isShowAll ? totalItems : Math.min(currentPage * pageSize, totalItems)

  if (totalItems <= pageSizeOptions[0]) return null

  return (
    <div className={`grid grid-cols-[auto_auto] sm:flex justify-end items-center gap-3 ${className}`.trim()}>
      {/* Per-page selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs sm:w-auto text-gray-500 dark:text-gray-400">Per page:</span>
        <select
          value={isShowAll ? 'Infinity' : pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
          aria-label="Items per page"
          name="paginationSize"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
          <option value="Infinity">All</option>
        </select>
      </div>

      {/* Count label */}
      <span className="flex hidden sm:flex justify-center text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        {from}–{to} of {totalItems}
      </span>

      {/* Prev / Next */}
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isShowAll || currentPage <= 1}
          className="inline-flex items-center gap-1 px-3 py-2.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <span className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 tabular-nums">
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isShowAll || currentPage >= totalPages}
          className="inline-flex items-center gap-1 px-3 py-2.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
