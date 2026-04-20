'use client'

interface Props {
  currentPage: number
  totalItems: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 30, 60],
  onPageChange,
  onPageSizeChange,
}: Props) {
  const isShowAll = !isFinite(pageSize)
  const totalPages = isShowAll ? 1 : Math.max(1, Math.ceil(totalItems / pageSize))
  const from = totalItems === 0 ? 0 : isShowAll ? 1 : (currentPage - 1) * pageSize + 1
  const to = isShowAll ? totalItems : Math.min(currentPage * pageSize, totalItems)

  if (totalItems <= pageSizeOptions[0]) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
      {/* Per-page selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Per page:</span>
        <select
          value={isShowAll ? 'Infinity' : pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
          aria-label="Items per page"
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
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        {from}–{to} of {totalItems}
      </span>

      {/* Prev / Next */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isShowAll || currentPage <= 1}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Prev
        </button>

        <span className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 tabular-nums">
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isShowAll || currentPage >= totalPages}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          Next
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
