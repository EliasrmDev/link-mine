'use client'

import type { Bookmark, Folder } from '@linkmine/shared'

const STALE_DAYS = 30

function isStale(bookmark: Bookmark): boolean {
  const now = Date.now()
  const staleCutoff = now - STALE_DAYS * 24 * 60 * 60 * 1000
  if (bookmark.lastAccessed) {
    return new Date(bookmark.lastAccessed).getTime() < staleCutoff
  }
  return new Date(bookmark.createdAt).getTime() < staleCutoff
}

function isReminderDue(bookmark: Bookmark): boolean {
  if (!bookmark.reminderDate) return false
  return new Date(bookmark.reminderDate).getTime() <= Date.now()
}

function isReminderUpcoming(bookmark: Bookmark): boolean {
  if (!bookmark.reminderDate) return false
  const diff = new Date(bookmark.reminderDate).getTime() - Date.now()
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000 // within 3 days
}

function trackAccess(id: string) {
  // Fire-and-forget — doesn't block navigation
  fetch(`/api/bookmarks/${id}/access`, { method: 'PATCH' }).catch(() => {})
}

interface Props {
  bookmarks: Bookmark[]
  total: number
  loading: boolean
  folders: Folder[]
  onEdit: (bookmark: Bookmark) => void
  onDelete: (id: string) => void
  showOldLinks?: boolean
}

export function BookmarkGrid({ bookmarks, total, loading, onEdit, onDelete, showOldLinks }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600" />
        <span className="sr-only">Loading bookmarks…</span>
      </div>
    )
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center" aria-live="polite">
        <div className="mb-4 text-5xl" aria-hidden="true">🔖</div>
        <p className="text-lg font-medium text-gray-900 dark:text-white">No bookmarks yet</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Save a page from the extension or click &ldquo;Add bookmark&rdquo;.
        </p>
      </div>
    )
  }

  const staleBookmarks = showOldLinks ? bookmarks.filter(isStale) : []
  const mainBookmarks = showOldLinks ? bookmarks.filter((b) => !isStale(b)) : bookmarks

  return (
    <div>
      <section aria-label={`Bookmarks (${total} total)`}>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
          {total} {total === 1 ? 'bookmark' : 'bookmarks'}
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
          {mainBookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </section>

      {staleBookmarks.length > 0 && (
        <section className="mt-10" aria-label="You may want to revisit these">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              You may want to revisit these
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              not opened in {STALE_DAYS}+ days
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 opacity-70" role="list">
            {staleBookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function BookmarkCard({
  bookmark,
  onEdit,
  onDelete,
}: {
  bookmark: Bookmark
  onEdit: (b: Bookmark) => void
  onDelete: (id: string) => void
}) {
  const domain = (() => {
    try { return new URL(bookmark.url).hostname } catch { return '' }
  })()

  const favicon = `https://${domain}/favicon.ico`
  const due = isReminderDue(bookmark)
  const upcoming = isReminderUpcoming(bookmark)

  return (
    <li
      className={`card group flex flex-col p-4 transition hover:shadow-md ${
        due ? 'ring-1 ring-amber-400 dark:ring-amber-500' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon or favicon */}
        {bookmark.icon ? (
          bookmark.icon.startsWith('http') ? (
            // Favicon URL
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bookmark.icon}
              alt=""
              width={16}
              height={16}
              className="mt-0.5 h-4 w-4 shrink-0 rounded"
              onError={(e) => {
                const target = e.currentTarget
                // Try Google favicon service as fallback
                if (!target.src.includes('google.com/s2/favicons')) {
                  target.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
                }
              }}
            />
          ) : (
            // Emoji icon
            <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden="true">
              {bookmark.icon}
            </span>
          )
        ) : (
          // Default favicon fallback
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={favicon}
            alt=""
            width={16}
            height={16}
            className="mt-0.5 h-4 w-4 shrink-0 rounded"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}

        {/* Title & URL */}
        <div className="min-w-0 flex-1">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackAccess(bookmark.id)}
            className="block truncate text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-600"
          >
            {bookmark.title}
          </a>
          <p className="mt-0.5 truncate text-xs text-gray-400">{domain}</p>
        </div>

        {/* Reminder indicator */}
        {(due || upcoming) && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              due
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
            }`}
            title={
              bookmark.reminderDate
                ? `Reminder: ${new Date(bookmark.reminderDate).toLocaleDateString()}`
                : ''
            }
          >
            {due ? '⏰ Due' : 'Soon'}
          </span>
        )}
      </div>

      {/* Tags */}
      {bookmark.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1" aria-label="Tags">
          {bookmark.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
        <div className="flex min-w-0 flex-col gap-0.5">
          {bookmark.folder && (
            <span className="truncate text-xs text-gray-400">
              📁 {bookmark.folder.name}
            </span>
          )}
          {bookmark.reminderDate && (
            <span className="text-xs text-gray-400">
              🔔 {new Date(bookmark.reminderDate).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onEdit(bookmark)}
            aria-label={`Edit bookmark: ${bookmark.title}`}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(bookmark.id)}
            aria-label={`Delete bookmark: ${bookmark.title}`}
            className="rounded p-1 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </li>
  )
}
