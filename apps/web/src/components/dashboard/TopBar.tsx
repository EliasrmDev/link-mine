'use client'

import { useState } from 'react'
import { Search, Plus, Menu, X } from 'lucide-react'
import { Pagination } from './Pagination'

interface Props {
  query: string
  onSearch: (q: string) => void
  onAddBookmark: () => void
  activeView: 'bookmarks' | 'tags-icons'
  currentPage: number
  totalItems: number
  pageSize: number
  onViewChange: (view: 'bookmarks' | 'tags-icons') => void
  onToggleSidebar: () => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function TopBar({
  query,
  onSearch,
  onAddBookmark,
  activeView,
  currentPage,
  totalItems,
  pageSize,
  onViewChange,
  onToggleSidebar,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const [searchExpanded, setSearchExpanded] = useState(false)

  return (
    <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Navigation tabs with hamburger menu */}
      <div className="px-4 sm:px-6 pt-3">
        <div className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[1fr_auto] w-full">
          {/* Hamburger menu button for mobile */}
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Navigation tabs */}
          <nav className="flex space-x-6 sm:space-x-8">
            <button
              onClick={() => onViewChange('bookmarks')}
              className={`py-3 px-3 font-medium text-sm border-b-2 transition-colors ${
                activeView === 'bookmarks'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Bookmarks
            </button>
            <button
              onClick={() => onViewChange('tags-icons')}
              className={`py-3 px-3 font-medium text-sm border-b-2 transition-colors ${
                activeView === 'tags-icons'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="hidden sm:inline">Tags & Icons</span>
              <span className="sm:hidden">Tags</span>
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {activeView === 'bookmarks' && (
              <button onClick={onAddBookmark} className="btn-primary px-4 py-3 text-base md:px-4 md:py-2 md:text-sm">
                <Plus className="h-5 w-5 md:h-4 md:w-4" />
                <span className="hidden sm:inline ml-2">Add bookmark</span>
                <span className="sm:hidden ml-1">Add</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main header with search and actions */}
      <header className="px-4 py-3 sm:px-6">
        {/* Search (only show on bookmarks view) */}
        {activeView === 'bookmarks' && (
          <div className={`grid ${searchExpanded ? 'grid-cols-1' : 'grid-cols-[auto_1fr_auto]'} sm:grid-cols-2 gap-3`}>
            {/* Mobile: Search button that expands */}
            <div className="md:hidden flex items-center">
              {!searchExpanded ? (
                <button
                  onClick={() => setSearchExpanded(true)}
                  className="btn-secondary p-3"
                  aria-label="Search bookmarks"
                >
                  <Search className="h-5 w-5" />
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="search-input-mobile"
                      type="search"
                      placeholder="Search bookmarks…"
                      value={query}
                      onChange={(e) => onSearch(e.target.value)}
                      className="input pl-9 w-full"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => setSearchExpanded(false)}
                    className="btn-ghost p-2"
                    aria-label="Close search"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Desktop: Always visible search */}
            <div className="hidden md:block relative flex-1 max-w-1/2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="search-input"
                type="search"
                placeholder="Search bookmarks…"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                className="input pl-9 w-full"
              />
            </div>

            {/* New Pagination location  */}
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              className={`border-0 px-0 py-0 xl:justify-end ${searchExpanded ? 'hidden sm:flex' : 'flex'}`}
            />
          </div>
        )}

        {/* Spacer for tags-icons view */}
        {activeView === 'tags-icons' && <div className="flex-1" />}
      </header>
    </div>
  )
}
