'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { Bookmark, Folder, BookmarkFilters } from '@linkmine/shared'
import { Sidebar } from './Sidebar'
import { BookmarkGrid } from './BookmarkGrid'
import { BookmarkForm } from './BookmarkForm'
import { FolderForm } from './FolderForm'
import { TopBar } from './TopBar'
import { FilterBar } from './FilterBar'
import { TagsIconsManager } from './TagsIconsManager'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Breadcrumb } from './Breadcrumb'
import { SubfolderGrid } from './SubfolderGrid'

const FILTERS_STORAGE_KEY = 'linkmine_filters'

const DEFAULT_FILTERS: BookmarkFilters = {
  sortBy: 'createdAt',
  sortDir: 'desc',
  tags: [],
  hasReminder: false,
}

const SSE_REFRESH_DEBOUNCE_MS = 200

// Helper function to detect if an icon is an automatic favicon
function isAutomaticFavicon(icon: string, url: string): boolean {
  if (!icon || !url) return false

  try {
    const domain = new URL(url).hostname

    // Check if icon is a favicon URL pattern
    const faviconPatterns = [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}`,
      /^https:\/\/[^\/]+\/favicon\.ico$/,
      /^https:\/\/www\.google\.com\/s2\/favicons/,
      /^https:\/\/.*\.(ico|png|jpg|jpeg|gif|svg)$/i
    ]

    // If icon matches any favicon URL pattern, it's automatic
    for (const pattern of faviconPatterns) {
      if (pattern instanceof RegExp) {
        if (pattern.test(icon)) return true
      } else if (typeof pattern === 'string') {
        if (icon.includes(pattern)) return true
      }
    }

    // If icon is a URL (contains protocol), likely a favicon
    if (icon.startsWith('http://') || icon.startsWith('https://')) {
      return true
    }

    // If icon is a single emoji or short text, it's manual
    return false

  } catch {
    // If URL parsing fails, assume it's manual
    return false
  }
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
  initialTagsWithCounts: Array<{ name: string; count: number }>
  initialIconsWithCounts: Array<{ icon: string; count: number }>
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

export function DashboardClient({ initialBookmarks, initialTotal, initialFolders, initialTagsWithCounts, initialIconsWithCounts, user }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [total, setTotal] = useState(initialTotal)
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [unsortedCount, setUnsortedCount] = useState(
    Math.max(initialTotal - countBookmarksInFolders(initialFolders), 0),
  )
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | 'all'>('all')
  const [folderHierarchy, setFolderHierarchy] = useState<Array<{ id: string | 'all'; name: string }>>([
    { id: 'all', name: 'All bookmarks' }
  ])
  const [currentSubfolders, setCurrentSubfolders] = useState<Folder[]>([])
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<BookmarkFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState<'bookmarks' | 'tags-icons'>('bookmarks')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Modal state
  const [bookmarkForm, setBookmarkForm] = useState<{
    open: boolean
    bookmark?: Bookmark
    draft?: {
      url: string
      title: string
      tags: string[]
      icon: string
      reminderDate: string
      folderId: string
    }
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
  const [returnToBookmarkAfterFolder, setReturnToBookmarkAfterFolder] = useState(false)

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const sseRefreshTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // Load persisted filters on mount
  useEffect(() => {
    setFilters(loadFilters())
  }, [])

  // Collect all unique tags from current bookmarks for FilterBar suggestions
  const allTags = useMemo(() => {
    const set = new Set<string>()
    bookmarks.forEach((b) => b.tags.forEach((t) => set.add(t.trim().toLowerCase())))
    return Array.from(set).sort()
  }, [bookmarks])

  const iconsInUse = useMemo(() => {
    const set = new Set<string>()
    bookmarks.forEach((b) => {
      if (b.icon && !isAutomaticFavicon(b.icon, b.url)) {
        set.add(b.icon)
      }
    })
    return Array.from(set)
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

  const refreshFromServer = useCallback(async () => {
    await Promise.all([
      fetchBookmarks({ folderId: selectedFolderId, q: query }),
      fetchFolders(),
    ])
  }, [fetchBookmarks, fetchFolders, selectedFolderId, query])

  // Navigate to a folder and update breadcrumbs
  const navigateToFolder = useCallback((folderId: string | null | 'all', folderName?: string) => {
    setSelectedFolderId(folderId)

    if (folderId === 'all') {
      setFolderHierarchy([{ id: 'all', name: 'All bookmarks' }])
      setCurrentSubfolders([])
    } else if (folderId === 'none') {
      setFolderHierarchy([{ id: 'all', name: 'All bookmarks' }, { id: 'none', name: 'Unsorted' }])
      setCurrentSubfolders([])
    } else if (folderId) {
      // Find the folder to navigate to
      const targetFolder = folders.find(f => f.id === folderId) ||
        folders.flatMap(f => f.children || []).find(c => c.id === folderId)

      if (targetFolder) {
        // Check if it's a child folder
        const parentFolder = folders.find(f => f.children?.some(c => c.id === folderId))

        if (parentFolder) {
          // It's a child folder - show breadcrumb with parent
          setFolderHierarchy([
            { id: 'all', name: 'All bookmarks' },
            { id: parentFolder.id, name: parentFolder.name },
            { id: folderId, name: targetFolder.name }
          ])
          setCurrentSubfolders([])
        } else {
          // It's a parent folder - show its children as subfolders
          setFolderHierarchy([
            { id: 'all', name: 'All bookmarks' },
            { id: folderId, name: targetFolder.name }
          ])
          setCurrentSubfolders(targetFolder.children || [])
        }
      }
    }

    void fetchBookmarks({ folderId, q: query })
  }, [folders, query, fetchBookmarks])

  // Go back in breadcrumb navigation
  const goBackToParent = useCallback(() => {
    if (folderHierarchy.length > 1) {
      const parentLevel = folderHierarchy[folderHierarchy.length - 2]
      navigateToFolder(parentLevel.id, parentLevel.name)
    }
  }, [folderHierarchy, navigateToFolder])

  // SSE subscription for real-time sync
  useEffect(() => {
    const es = new EventSource('/api/sync/stream')

    const scheduleRefresh = () => {
      if (sseRefreshTimeout.current) clearTimeout(sseRefreshTimeout.current)
      sseRefreshTimeout.current = setTimeout(() => {
        void refreshFromServer()
      }, SSE_REFRESH_DEBOUNCE_MS)
    }

    const onBookmarkSaved = () => { scheduleRefresh() }
    const onBookmarkDeleted = () => { scheduleRefresh() }
    const onFoldersChanged = () => { scheduleRefresh() }

    es.addEventListener('bookmark:saved', onBookmarkSaved)
    es.addEventListener('bookmark:deleted', onBookmarkDeleted)
    es.addEventListener('folders:changed', onFoldersChanged)

    return () => {
      if (sseRefreshTimeout.current) clearTimeout(sseRefreshTimeout.current)
      es.removeEventListener('bookmark:saved', onBookmarkSaved)
      es.removeEventListener('bookmark:deleted', onBookmarkDeleted)
      es.removeEventListener('folders:changed', onFoldersChanged)
      es.close()
    }
  }, [refreshFromServer])

  const handleSearch = (q: string) => {
    setQuery(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      fetchBookmarks({ folderId: selectedFolderId, q })
    }, 300)
  }

  const handleFolderSelect = (id: string | null | 'all') => {
    navigateToFolder(id)
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

  const handleFolderSaved = async (savedFolder?: Folder) => {
    setFolderForm({ open: false })
    await fetchFolders()

    if (returnToBookmarkAfterFolder) {
      setBookmarkForm((prev) => {
        if (!prev.draft) return { open: true }
        return {
          open: true,
          draft: {
            ...prev.draft,
            folderId: savedFolder?.id ?? prev.draft.folderId,
          },
        }
      })
      setReturnToBookmarkAfterFolder(false)
    }
  }

  const handleOpenCreateFolderFromBookmark = (draft: {
    url: string
    title: string
    tags: string[]
    icon: string
    reminderDate: string
    folderId: string
  }) => {
    setBookmarkForm({ open: false, draft })
    setReturnToBookmarkAfterFolder(true)
    setFolderForm({ open: true, parentId: null })
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

    // If the deleted folder is currently selected, navigate back to parent or "All bookmarks"
    if (selectedFolderId === id) {
      if (folderHierarchy.length > 1) {
        const parentLevel = folderHierarchy[folderHierarchy.length - 2]
        navigateToFolder(parentLevel.id, parentLevel.name)
      } else {
        navigateToFolder('all')
      }
    }
  }

  // Tags and Icons Management
  const handleTagRenamed = async (oldName: string, newName: string) => {
    const response = await fetch('/api/tags/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldTag: oldName, newTag: newName }),
    })

    if (!response.ok) {
      throw new Error('Failed to rename tag')
    }

    // Refresh bookmarks to show updated tags
    await refreshFromServer()
  }

  const handleTagDeleted = async (tagName: string) => {
    const response = await fetch('/api/tags/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: tagName }),
    })

    if (!response.ok) {
      throw new Error('Failed to delete tag')
    }

    // Refresh bookmarks to show updated tags
    await refreshFromServer()
  }

  const handleIconUpdated = async (oldIcon: string, newIcon: string) => {
    const response = await fetch('/api/icons/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldIcon, newIcon }),
    })

    if (!response.ok) {
      throw new Error('Failed to update icon')
    }

    // Refresh bookmarks to show updated icons
    await refreshFromServer()
  }

  const handleTagCreated = async (tagName: string) => {
    const response = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'TAG', value: tagName }),
    })

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('Tag already exists')
      }
      throw new Error('Failed to create tag')
    }

    // Refresh data to show new tag
    await refreshFromServer()
  }

  const handleIconCreated = async (icon: string) => {
    const response = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ICON', value: icon }),
    })

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('Icon already exists')
      }
      throw new Error('Failed to create icon')
    }

    // Refresh data to show new icon
    await refreshFromServer()
  }

  const handleIconDeleted = async (icon: string) => {
    const response = await fetch('/api/icons/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icon }),
    })

    if (!response.ok) {
      throw new Error('Failed to delete icon')
    }

    // Refresh bookmarks to show updated icons
    await refreshFromServer()
  }

  // Get current section name for mobile label
  const getCurrentSectionName = (): string => {
    if (activeView === 'tags-icons') {
      return 'Tags & Icons'
    }
    if (folderHierarchy.length > 0) {
      const current = folderHierarchy[folderHierarchy.length - 1]
      return current.name
    }
    return 'All bookmarks'
  }

  // Show old-links section only when not actively filtering/searching
  const showOldLinks = !query && !(filters.tags?.length) && !filters.icon

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-30 w-full lg:w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 h-full`}>
        <div className="relative h-full">
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 right-4 z-40 lg:hidden p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <Sidebar
            folders={folders}
            unsortedCount={unsortedCount}
            selectedFolderId={selectedFolderId}
            onSelectFolder={(id) => {
              navigateToFolder(id)
              setSidebarOpen(false) // Close sidebar on mobile after selection
            }}
            onAddFolder={(parentId) => setFolderForm({ open: true, parentId })}
            onEditFolder={(folder) => setFolderForm({ open: true, folder })}
            onDeleteFolder={handleDeleteFolder}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden lg:ml-0">
        <TopBar
          user={user}
          query={query}
          onSearch={handleSearch}
          onAddBookmark={() => setBookmarkForm({ open: true })}
          activeView={activeView}
          onViewChange={setActiveView}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Mobile section indicator */}
        <div className="lg:hidden bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {getCurrentSectionName()}
          </span>
        </div>

        {(activeView === 'bookmarks') && (
          <FilterBar
            filters={filters}
            allTags={allTags}
            iconsInUse={iconsInUse}
            onChange={handleFiltersChange}
            onReset={handleFiltersReset}
          />
        )}

        <main className="flex-1 overflow-y-auto p-6" id="main-content">
          {activeView === 'bookmarks' ? (
            <div className="space-y-6">
              {/* Breadcrumb navigation */}
              {folderHierarchy.length > 1 && (
                <Breadcrumb
                  hierarchy={folderHierarchy}
                  onNavigate={navigateToFolder}
                  onBack={goBackToParent}
                />
              )}

              {/* Subfolders grid */}
              {currentSubfolders.length > 0 && (
                <SubfolderGrid
                  subfolders={currentSubfolders}
                  onNavigate={navigateToFolder}
                  onEdit={(folder) => setFolderForm({ open: true, folder })}
                  onDelete={handleDeleteFolder}
                />
              )}

              <BookmarkGrid
                bookmarks={bookmarks}
                total={total}
                loading={loading}
                folders={folders}
                onEdit={(b) => setBookmarkForm({ open: true, bookmark: b })}
                onDelete={handleDeleteBookmark}
                showOldLinks={showOldLinks}
              />
            </div>
          ) : (
            <TagsIconsManager
              allTags={allTags}
              iconsInUse={iconsInUse}
              initialTags={initialTagsWithCounts}
              initialIcons={initialIconsWithCounts}
              onTagRenamed={handleTagRenamed}
              onTagDeleted={handleTagDeleted}
              onIconUpdated={handleIconUpdated}
              onIconDeleted={handleIconDeleted}
              onTagCreated={handleTagCreated}
              onIconCreated={handleIconCreated}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {bookmarkForm.open && (
        <BookmarkForm
          bookmark={bookmarkForm.bookmark}
          initialDraft={bookmarkForm.draft}
          folders={folders}
          defaultFolderId={selectedFolderId !== 'all' ? (selectedFolderId ?? null) : null}
          onOpenCreateFolder={handleOpenCreateFolderFromBookmark}
          onEditExisting={(existingBookmark) => setBookmarkForm({ open: true, bookmark: existingBookmark })}
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
          onClose={() => {
            setFolderForm({ open: false })
            if (returnToBookmarkAfterFolder) {
              setBookmarkForm((prev) => ({ open: true, draft: prev.draft }))
              setReturnToBookmarkAfterFolder(false)
            }
          }}
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
