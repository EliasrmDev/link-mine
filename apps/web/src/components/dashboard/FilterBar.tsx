'use client'

import { useState } from 'react'
import type { BookmarkFilters } from '@savepath/shared'

interface Props {
  filters: BookmarkFilters
  allTags: string[]
  iconsInUse: string[]
  onChange: (f: BookmarkFilters) => void
  onReset: () => void
}

export function FilterBar({ filters, allTags, iconsInUse, onChange, onReset }: Props) {
  const [open, setOpen] = useState(false)

  const activeCount = [
    (filters.tags?.length ?? 0) > 0,
    !!filters.icon,
    !!filters.hasReminder,
    !!filters.sortBy && filters.sortBy !== 'createdAt',
  ].filter(Boolean).length

  function toggleTag(tag: string) {
    const current = filters.tags ?? []
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    onChange({ ...filters, tags: next })
  }

  function toggleIcon(icon: string) {
    onChange({ ...filters, icon: filters.icon === icon ? undefined : icon })
  }

  function setSortBy(sortBy: BookmarkFilters['sortBy']) {
    onChange({ ...filters, sortBy })
  }

  function toggleSortDir() {
    onChange({ ...filters, sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })
  }

  function toggleReminder() {
    onChange({ ...filters, hasReminder: !filters.hasReminder })
  }

  return (
    <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Always-visible toolbar row */}
      <div className="flex items-center gap-2 px-6 py-2">
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

        {/* Active filter pills */}
        <div className="flex flex-1 flex-wrap gap-1">
          {(filters.tags ?? []).map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300"
            >
              {tag}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
          {filters.icon && (
            <button
              onClick={() => toggleIcon(filters.icon!)}
              className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            >
              {filters.icon} ×
            </button>
          )}
          {filters.hasReminder && (
            <button
              onClick={toggleReminder}
              className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300"
            >
              With reminders ×
            </button>
          )}
          {activeCount > 0 && (
            <button
              onClick={onReset}
              className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex shrink-0 items-center gap-1">
          <select
            value={filters.sortBy ?? 'createdAt'}
            onChange={(e) => setSortBy(e.target.value as BookmarkFilters['sortBy'])}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            aria-label="Sort by"
          >
            <option value="createdAt">Date saved</option>
            <option value="lastAccessed">Last opened</option>
            <option value="reminderDate">Reminder date</option>
          </select>
          <button
            onClick={toggleSortDir}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={filters.sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
            title={filters.sortDir === 'asc' ? 'Oldest first' : 'Newest first'}
          >
            {filters.sortDir === 'asc' ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <div id="filter-panel" className="border-t border-gray-100 px-6 py-3 dark:border-gray-800">
          <div className="flex flex-wrap gap-6">

            {/* Icon filter — predefined picker */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Icon</p>
              <div className="flex flex-wrap gap-1">
                {iconsInUse.map((icon) => {
                  const active = filters.icon === icon
                  return (
                    <button
                      key={icon}
                      onClick={() => toggleIcon(icon)}
                      className={`rounded p-1 text-base leading-none transition-colors ${
                        active
                          ? 'bg-brand-100 ring-1 ring-brand-500 dark:bg-brand-900/40'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      aria-pressed={active}
                      aria-label={`Filter by icon ${icon}`}
                      title={`Filter by ${icon}`}
                    >
                      {icon}
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
            {allTags.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {allTags.map((tag) => {
                    const active = (filters.tags ?? []).includes(tag)
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-brand-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                        aria-pressed={active}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Reminder filter */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Reminder</p>
              <button
                onClick={toggleReminder}
                aria-pressed={filters.hasReminder}
                className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                  filters.hasReminder
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                Has reminder
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
