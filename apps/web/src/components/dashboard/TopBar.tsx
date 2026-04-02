'use client'

import { signOut } from 'next-auth/react'
import Image from 'next/image'
import { useState } from 'react'
import { useTheme } from '../ThemeProvider'

interface Props {
  user: { name: string; image: string | null }
  query: string
  onSearch: (q: string) => void
  onAddBookmark: () => void
  activeView: 'bookmarks' | 'tags-icons'
  onViewChange: (view: 'bookmarks' | 'tags-icons') => void
}

export function TopBar({ user, query, onSearch, onAddBookmark, activeView, onViewChange }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { toggle } = useTheme()

  return (
    <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Navigation tabs */}
      <div className="px-6 pt-3">
        <nav className="flex space-x-8">
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
            Tags & Icons
          </button>
        </nav>
      </div>

      {/* Main header with search and actions */}
      <header className="flex items-center gap-3 px-6 py-3">
        {/* Search (only show on bookmarks view) */}
        {activeView === 'bookmarks' && (
          <div className="flex flex-1 items-center">
            <label htmlFor="search-input" className="sr-only">
              Search bookmarks
            </label>
            <div className="relative flex-1 max-w-md">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="search-input"
                type="search"
                placeholder="Search bookmarks…"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>
        )}

        {/* Spacer for tags-icons view */}
        {activeView === 'tags-icons' && <div className="flex-1" />}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {activeView === 'bookmarks' && (
            <button onClick={onAddBookmark} className="btn-primary">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add bookmark
            </button>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="btn-secondary p-2"
            aria-label="Toggle dark mode"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>

          {/* User menu */}
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
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {user.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <span className="hidden text-sm font-medium sm:block">{user.name}</span>
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
                  className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                >
                  <a
                    href="/dashboard/settings"
                    role="menuitem"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Settings
                  </a>
                  <hr className="my-1 border-gray-200 dark:border-gray-700" />
                  <button
                    role="menuitem"
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    </div>
  )
}
