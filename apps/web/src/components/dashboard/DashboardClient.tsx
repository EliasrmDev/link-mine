'use client'

import { useState, useCallback, useRef } from 'react'
import type { Bookmark, Folder } from '@savepath/shared'
import { Sidebar } from './Sidebar'
import { BookmarkGrid } from './BookmarkGrid'
import { BookmarkForm } from './BookmarkForm'
import { FolderForm } from './FolderForm'
import { TopBar } from './TopBar'

interface Props {
  initialBookmarks: Bookmark[]
  initialTotal: number
  initialFolders: Folder[]
  user: { name: string; image: string | null }
}

export function DashboardClient({ initialBookmarks, initialTotal, initialFolders, user }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [total, setTotal] = useState(initialTotal)
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | 'all'>('all')
  const [query, setQuery] = useState('')
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

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  const fetchBookmarks = useCallback(
    async (opts: { folderId?: string | null | 'all'; q?: string; page?: number } = {}) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (opts.q) params.set('q', opts.q)
        if (opts.folderId && opts.folderId !== 'all') params.set('folderId', opts.folderId)
        params.set('page', String(opts.page ?? 1))
        params.set('pageSize', '20')

        const res = await fetch(`/api/bookmarks?${params}`)
        if (!res.ok) throw new Error('Failed to fetch bookmarks')
        const data = await res.json()
        setBookmarks(data.bookmarks)
        setTotal(data.total)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const fetchFolders = useCallback(async () => {
    const res = await fetch('/api/folders')
    if (!res.ok) return
    setFolders(await res.json())
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

  const handleBookmarkSaved = async () => {
    setBookmarkForm({ open: false })
    await fetchBookmarks({ folderId: selectedFolderId, q: query })
    await fetchFolders()
  }

  const handleFolderSaved = async () => {
    setFolderForm({ open: false })
    await fetchFolders()
  }

  const handleDeleteBookmark = async (id: string) => {
    await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
    setTotal((t) => t - 1)
    await fetchFolders() // update counts
  }

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Delete this folder? Bookmarks inside will be moved to "All bookmarks".')) return
    await fetch(`/api/folders/${id}`, { method: 'DELETE' })
    await Promise.all([fetchFolders(), fetchBookmarks({ folderId: 'all', q: query })])
    if (selectedFolderId === id) setSelectedFolderId('all')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar
        folders={folders}
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

        <main className="flex-1 overflow-y-auto p-6" id="main-content">
          <BookmarkGrid
            bookmarks={bookmarks}
            total={total}
            loading={loading}
            folders={folders}
            onEdit={(b) => setBookmarkForm({ open: true, bookmark: b })}
            onDelete={handleDeleteBookmark}
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
    </div>
  )
}
