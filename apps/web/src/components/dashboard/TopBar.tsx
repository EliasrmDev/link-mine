'use client'

import { signOut } from 'next-auth/react'
import Image from 'next/image'
import { useState } from 'react'
import { Search, Plus, Settings, LogOut, Menu, X } from 'lucide-react'

interface Props {
  user: { name: string; image: string | null }
  query: string
  onSearch: (q: string) => void
  onAddBookmark: () => void
  activeView: 'bookmarks' | 'tags-icons'
  onViewChange: (view: 'bookmarks' | 'tags-icons') => void
  onToggleSidebar: () => void
}

export function TopBar({ user, query, onSearch, onAddBookmark, activeView, onViewChange, onToggleSidebar }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)

  return (
    <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Navigation tabs with hamburger menu */}
      <div className="px-4 sm:px-6 pt-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
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
                className={`py-2 px-1 font-medium text-sm border-b-2 transition-colors ${
                  activeView === 'bookmarks'
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Bookmarks
              </button>
              <button
                onClick={() => onViewChange('tags-icons')}
                className={`py-2 px-1 font-medium text-sm border-b-2 transition-colors ${
                  activeView === 'tags-icons'
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="hidden sm:inline">Tags & Icons</span>
                <span className="sm:hidden">Tags</span>
              </button>
            </nav>
          </div>

          {/* User profile - always visible on right */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="User menu"
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt=""
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {user.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 dark:border-gray-700 dark:bg-gray-800"
                >
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  <hr className="my-1 border-gray-200 dark:border-gray-700" />
                  <button
                    role="menuitem"
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:text-red-400 dark:hover:bg-gray-700"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main header with search and actions */}
      <header className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3">
        {/* Search (only show on bookmarks view) */}
        {activeView === 'bookmarks' && (
          <div className="flex flex-1 items-center">
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
            <div className="hidden md:block relative flex-1 max-w-md">
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
          </div>
        )}

        {/* Spacer for tags-icons view */}
        {activeView === 'tags-icons' && <div className="flex-1" />}

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {activeView === 'bookmarks' && !searchExpanded && (
            <button onClick={onAddBookmark} className="btn-primary px-4 py-3 text-base md:px-4 md:py-2 md:text-sm">
              <Plus className="h-5 w-5 md:h-4 md:w-4" />
              <span className="hidden sm:inline ml-2">Add bookmark</span>
              <span className="sm:hidden ml-1">Add</span>
            </button>
          )}
        </div>
      </header>
    </div>
  )
}
