'use client'

import { useState } from 'react'
import type { BookmarkFilters } from '@linkmine/shared'

interface Props {
  filters: BookmarkFilters
  allTagsWithCounts: { name: string; count: number }[]
  iconsInUse: { icon: string; count: number }[]
  onChange: (f: BookmarkFilters) => void
  onReset: () => void
  onClose?: () => void
}

export function FilterBar({ filters, allTagsWithCounts, iconsInUse, onChange, onReset, onClose }: Props) {
  const [open, setOpen] = useState(false)

  const activeCount = [
    (filters.tags?.length ?? 0) > 0,
    !!filters.icon,
  ].filter(Boolean).length

  function toggleTag(tag: string) {
    const current = filters.tags ?? []
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    onChange({ ...filters, tags: next })
  }

  function toggleIcon(icon: string) {
    onChange({ ...filters, icon: filters.icon === icon ? undefined : icon })
  }

  return (
    <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Always-visible toolbar row */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-2">
        {/* Filter toggle */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-expanded={open}
          aria-controls="filter-panel"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>

        <div className="flex-1"></div>

        {/* Close button */}
        {open && (
          <button
            onClick={() => {
              setOpen(false)
              onClose?.()
            }}
            className="rounded p-2 sm:p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] sm:min-h-0 flex items-center justify-center"
            aria-label="Close filters"
            title="Close filters"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

      </div>

      {/* Expanded panel */}
      {open && (
        <div id="filter-panel" className="border-t border-gray-100 px-4 sm:px-6 py-3 dark:border-gray-800">
          {/* Active filters section */}
          {activeCount > 0 && (
            <div className="mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Active Filters</p>
                <button
                  onClick={onReset}
                  className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:text-gray-300 dark:hover:bg-gray-800 px-2 py-1 rounded transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(filters.tags ?? []).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 transition-colors"
                  >
                    {tag}
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ))}
                {filters.icon && (
                  <button
                    onClick={() => toggleIcon(filters.icon!)}
                    className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 transition-colors"
                  >
                    {filters.icon} ×
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-6">

            {/* Icon filter — predefined picker */}
            <div className="w-full sm:w-auto">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Icon</p>
              <div className="grid grid-cols-8 sm:flex sm:flex-wrap gap-2 sm:gap-1">
                {iconsInUse.map(({ icon, count }) => {
                  const active = filters.icon === icon
                  return (
                    <button
                      key={icon}
                      onClick={() => toggleIcon(icon)}
                      className={`relative rounded p-2 sm:p-1 text-lg sm:text-base leading-none transition-colors min-h-[44px] sm:min-h-0 flex items-center justify-center ${
                        active
                          ? 'bg-brand-100 ring-1 ring-brand-500 dark:bg-brand-900/40'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      aria-pressed={active}
                      aria-label={`Filter by icon ${icon} (${count} bookmarks)`}
                      title={`Filter by ${icon} (${count} bookmarks)`}
                    >
                      {icon}
                      <span className="absolute -bottom-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-gray-500 dark:bg-gray-600 text-white text-[9px] font-medium px-0.5 leading-none select-none">
                        {count}
                      </span>
                    </button>
                  )
                })}
                {iconsInUse.length === 0 && (
                  <span className="text-xs text-gray-400">No icons in use</span>
                )}
                {/* Clear icon filter */}
                {filters.icon && (
                  <button
                    onClick={() => onChange({ ...filters, icon: undefined })}
                    className="ml-1 self-center text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Tags */}
            {allTagsWithCounts.length > 0 && (
              <div className="w-full sm:w-auto">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Tags</p>
                <div className="flex flex-wrap gap-2 sm:gap-1">
                  {allTagsWithCounts.map(({ name, count }) => {
                    const active = (filters.tags ?? []).includes(name)
                    return (
                      <button
                        key={name}
                        onClick={() => toggleTag(name)}
                        className={`rounded-full h-8 px-3 py-2 sm:px-2 sm:py-0.5 text-sm sm:text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 flex items-center gap-1 ${
                          active
                            ? 'bg-brand-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                        aria-pressed={active}
                      >
                        {name}
                        <span className={`text-[10px] ${active ? 'opacity-80' : 'opacity-60'}`}>({count})</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
