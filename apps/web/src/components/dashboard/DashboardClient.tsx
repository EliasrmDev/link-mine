'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { Bookmark, Folder, BookmarkFilters } from '@savepath/shared'
import { Sidebar } from './Sidebar'
import { BookmarkGrid } from './BookmarkGrid'
import { BookmarkForm } from './BookmarkForm'
import { FolderForm } from './FolderForm'
import { TopBar } from './TopBar'
import { FilterBar } from './FilterBar'
import { ConfirmModal } from '../ui/ConfirmModal'

const FILTERS_STORAGE_KEY = 'savepath_filters'

const DEFAULT_FILTERS: BookmarkFilters = {
  sortBy: 'createdAt',
  sortDir: 'desc',
  tags: [],
  hasReminder: false,
}

function loadFilters(): BookmarkFilters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
    return raw ? { ...DEFAULT_FILTERS, ...JSON.parse(raw) } : DEFAULT_FILTERS
  } catch {
    return DEFAULT_FILTERS
  }
}

function saveFilters(f: BookmarkFilters) {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(f))
  } catch { /* ignore */ }
}

interface Props {
  initialBookmarks: Bookmark[]
  initialTotal: number
  initialFolders: Folder[]
  user: { name: string; image: string | null }
}

function countBookmarksInFolderTree(folder: Folder): number {
  const ownCount = folder._count?.bookmarks ?? 0
  const childrenCount = (folder.children ?? []).reduce(
    (sum, child) => sum + countBookmarksInFolderTree(child),
    0,
  )
  return ownCount + childrenCount
}

function countBookmarksInFolders(folders: Folder[]): number {
  return folders.reduce((sum, folder) => sum + countBookmarksInFolderTree(folder), 0)
}

export function DashboardClient({ initialBookmarks, initialTotal, initialFolders, user }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [total, setTotal] = useState(initialTotal)
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [unsortedCount, setUnsortedCount] = useState(
    Math.max(initialTotal - countBookmarksInFolders(initialFolders), 0),
  )
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | 'all'>('all')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<BookmarkFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(false)

  // Modal state
  const [bookmarkForm, setBookmarkForm] = useState<{
    open: boolean
    bookmark?: Bookmark
  }>({ open: false })
  const [folderForm, setFolderForm] = useState<{
    open: boolean
    folder?: Folder
    parentId?: string | null
  }>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean
    bookmarkId?: string
    bookmarkTitle?: string
  }>({ open: false })

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // Load persisted filters on mount
  useEffect(() => {
    setFilters(loadFilters())
  }, [])

  // SSE subscription for real-time sync
  useEffect(() => {
    const es = new EventSource('/api/sync/stream')

    es.addEventListener('bookmark:saved', (e) => {
      const bookmark: Bookmark = JSON.parse((e as MessageEvent).data)
      setBookmarks((prev) => {
        const idx = prev.findIndex((b) => b.id === bookmark.id)
        if (idx !== -1) {
          const next = [...prev]
          next[idx] = bookmark
          return next
        }
        return [bookmark, ...prev]
      })
      setTotal((t) => t)
    })

    es.addEventListener('bookmark:deleted', (e) => {
      const { id } = JSON.parse((e as MessageEvent).data)
      setBookmarks((prev) => prev.filter((b) => b.id !== id))
      setTotal((t) => Math.max(t - 1, 0))
    })

    es.addEventListener('folders:changed', () => {
      fetchFolders()
    })

    return () => es.close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Collect all unique tags from current bookmarks for FilterBar suggestions
  const allTags = useMemo(() => {
    const set = new Set<string>()
    bookmarks.forEach((b) => b.tags.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [bookmarks])

  const fetchBookmarks = useCallback(
    async (opts: {
      folderId?: string | null | 'all'
      q?: string
      page?: number
      filters?: BookmarkFilters
    } = {}) => {
      setLoading(true)
      try {
        const f = opts.filters ?? filters
        const params = new URLSearchParams()
        if (opts.q) params.set('q', opts.q)
        if (opts.folderId && opts.folderId !== 'all') params.set('folderId', opts.folderId)
        params.set('page', String(opts.page ?? 1))
        params.set('pageSize', '20')

        if (f.tags?.length) params.set('tags', f.tags.join(','))
        if (f.icon) params.set('icon', f.icon)
        if (f.hasReminder) params.set('hasReminder', 'true')
        if (f.sortBy) params.set('sortBy', f.sortBy)
        if (f.sortDir) params.set('sortDir', f.sortDir)

        const res = await fetch(`/api/bookmarks?${params}`)
        if (!res.ok) throw new Error('Failed to fetch bookmarks')
        const data = await res.json()
        setBookmarks(data.bookmarks)
        setTotal(data.total)
      } finally {
        setLoading(false)
      }
    },
    [filters],
  )

  const fetchFolders = useCallback(async () => {
    const [foldersRes, unsortedRes] = await Promise.all([
      fetch('/api/folders'),
      fetch('/api/bookmarks?folderId=none&page=1&pageSize=1'),
    ])

    if (foldersRes.ok) {
      setFolders(await foldersRes.json())
    }

    if (unsortedRes.ok) {
      const data = await unsortedRes.json()
      setUnsortedCount(data.total ?? 0)
    }
  }, [])

  const handleSearch = (q: string) => {
    setQuery(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      fetchBookmarks({ folderId: selectedFolderId, q })
    }, 300)
  }

  const handleFolderSelect = (id: string | null | 'all') => {
    setSelectedFolderId(id)
    fetchBookmarks({ folderId: id, q: query })
  }

  const handleFiltersChange = (next: BookmarkFilters) => {
    setFilters(next)
    saveFilters(next)
    fetchBookmarks({ folderId: selectedFolderId, q: query, filters: next })
  }

  const handleFiltersReset = () => {
    handleFiltersChange(DEFAULT_FILTERS)
  }

  const handleBookmarkSaved = async () => {
    setBookmarkForm({ open: false })
    await fetchBookmarks({ folderId: selectedFolderId, q: query })
    await fetchFolders()
  }

  const handleFolderSaved = async () => {
    setFolderForm({ open: false })
    await fetchFolders()
  }

  const handleDeleteBookmark = (id: string) => {
    const bookmark = bookmarks.find((b) => b.id === id)
    setDeleteConfirm({ open: true, bookmarkId: id, bookmarkTitle: bookmark?.title })
  }

  const doDeleteBookmark = async () => {
    const id = deleteConfirm.bookmarkId
    if (!id) return
    setDeleteConfirm({ open: false })
    const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      alert('Could not delete bookmark. Please try again.')
      return
    }
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
    setTotal((t) => t - 1)
    await fetchFolders()
  }

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Delete this folder? Bookmarks inside will be moved to "All bookmarks".')) return
    await fetch(`/api/folders/${id}`, { method: 'DELETE' })
    await Promise.all([fetchFolders(), fetchBookmarks({ folderId: 'all', q: query })])
    if (selectedFolderId === id) setSelectedFolderId('all')
  }

  // Show old-links section only when not actively filtering/searching
  const showOldLinks = !query && !(filters.tags?.length) && !filters.icon && !filters.hasReminder

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar
        folders={folders}
        unsortedCount={unsortedCount}
        selectedFolderId={selectedFolderId}
        onSelectFolder={handleFolderSelect}
        onAddFolder={(parentId) => setFolderForm({ open: true, parentId })}
        onEditFolder={(folder) => setFolderForm({ open: true, folder })}
        onDeleteFolder={handleDeleteFolder}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          user={user}
          query={query}
          onSearch={handleSearch}
          onAddBookmark={() => setBookmarkForm({ open: true })}
        />

        <FilterBar
          filters={filters}
          allTags={allTags}
          onChange={handleFiltersChange}
          onReset={handleFiltersReset}
        />

        <main className="flex-1 overflow-y-auto p-6" id="main-content">
          <BookmarkGrid
            bookmarks={bookmarks}
            total={total}
            loading={loading}
            folders={folders}
            onEdit={(b) => setBookmarkForm({ open: true, bookmark: b })}
            onDelete={handleDeleteBookmark}
            showOldLinks={showOldLinks}
          />
        </main>
      </div>

      {/* Modals */}
      {bookmarkForm.open && (
        <BookmarkForm
          bookmark={bookmarkForm.bookmark}
          folders={folders}
          defaultFolderId={selectedFolderId !== 'all' ? (selectedFolderId ?? null) : null}
          onSave={handleBookmarkSaved}
          onClose={() => setBookmarkForm({ open: false })}
        />
      )}

      {folderForm.open && (
        <FolderForm
          folder={folderForm.folder}
          parentId={folderForm.parentId}
          folders={folders}
          onSave={handleFolderSaved}
          onClose={() => setFolderForm({ open: false })}
        />
      )}

      {deleteConfirm.open && (
        <ConfirmModal
          title="Delete bookmark?"
          description={
            deleteConfirm.bookmarkTitle
              ? `"${deleteConfirm.bookmarkTitle}" will be permanently removed.`
              : 'This bookmark will be permanently removed.'
          }
          confirmLabel="Delete"
          destructive
          onConfirm={doDeleteBookmark}
          onCancel={() => setDeleteConfirm({ open: false })}
        />
      )}
    </div>
  )
}
