'use client'

import { useState, useCallback, useRef, useEffect, useMemo, useOptimistic, useTransition, useDeferredValue } from 'react'
import type { Bookmark, Folder, BookmarkFilters } from '@linkmine/shared'
import { Pagination } from './Pagination'
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
  initialFolders: Folder[]
  initialTagsWithCounts: Array<{ name: string; count: number }>
  initialIconsWithCounts: Array<{ icon: string; count: number }>
  initialDomainPreferences: Record<string, boolean>
  user: { name: string; image: string | null }
}

export function DashboardClient({ initialBookmarks, initialFolders, initialTagsWithCounts, initialIconsWithCounts, initialDomainPreferences, user }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [domainPreferences, setDomainPreferences] = useState<Record<string, boolean>>(initialDomainPreferences)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | 'all'>('all')
  const [folderHierarchy, setFolderHierarchy] = useState<Array<{ id: string | 'all'; name: string }>>([
    { id: 'all', name: 'All bookmarks' }
  ])
  const [currentSubfolders, setCurrentSubfolders] = useState<Folder[]>([])
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [filters, setFilters] = useState<BookmarkFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState<'bookmarks' | 'tags-icons'>('bookmarks')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('linkmine_sidebar_collapsed') === 'true'
  })
  const [pageSize, setPageSize] = useState(Infinity)
  const [currentPage, setCurrentPage] = useState(1)

  // Optimistic UI for instant bookmark deletion
  const [optimisticBookmarks, removeOptimisticBookmark] = useOptimistic(
    bookmarks,
    (state, deletedId: string) => state.filter((b) => b.id !== deletedId),
  )

  // Transition for non-urgent UI updates (filters, search, navigation)
  const [isPending, startTransition] = useTransition()

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

  const sseRefreshTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // Load persisted filters on mount
  useEffect(() => {
    setFilters(loadFilters())
  }, [])

  // Collect all unique tags with usage counts (for FilterBar)
  const allTagsWithCounts = useMemo(() => {
    const counts = new Map<string, number>()
    bookmarks.forEach((b) => b.tags.forEach((t) => {
      const tag = t.trim().toLowerCase()
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }))
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [bookmarks])

  // Plain string list (for TagsIconsManager suggestions)
  const allTags = useMemo(() => allTagsWithCounts.map((t) => t.name), [allTagsWithCounts])

  const iconsInUse = useMemo(() => {
    const counts = new Map<string, number>()
    bookmarks.forEach((b) => {
      if (b.icon && !isAutomaticFavicon(b.icon, b.url)) {
        counts.set(b.icon, (counts.get(b.icon) ?? 0) + 1)
      }
    })
    return Array.from(counts.entries())
      .map(([icon, count]) => ({ icon, count }))
      .sort((a, b) => b.count - a.count)
  }, [bookmarks])

  // Derive unsorted count from all bookmarks (no separate API call needed)
  const unsortedCount = useMemo(
    () => bookmarks.filter((b) => !b.folderId).length,
    [bookmarks],
  )

  // Client-side filtering: view → search → tags → icon → reminder → sort
  // Reads from optimisticBookmarks so optimistic deletes are reflected instantly
  const filteredBookmarks = useMemo(() => {
    let result = optimisticBookmarks

    // 1. View filter (folder selection)
    if (selectedFolderId === 'none') {
      result = result.filter((b) => !b.folderId)
    } else if (selectedFolderId && selectedFolderId !== 'all') {
      // Include bookmarks in this folder AND its child folders
      const childFolderIds = new Set<string>()
      childFolderIds.add(selectedFolderId)
      const parentFolder = folders.find((f) => f.id === selectedFolderId)
      if (parentFolder?.children) {
        parentFolder.children.forEach((c) => childFolderIds.add(c.id))
      }
      result = result.filter((b) => b.folderId && childFolderIds.has(b.folderId))
    }

    // 2. Search filter (uses deferredQuery for responsive input)
    const q = deferredQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }

    // 3. Tag filter
    if (filters.tags?.length) {
      result = result.filter((b) =>
        filters.tags!.some((t) => b.tags.includes(t)),
      )
    }

    // 4. Icon filter
    if (filters.icon) {
      result = result.filter((b) => b.icon === filters.icon)
    }

    // 5. Reminder filter
    if (filters.hasReminder) {
      result = result.filter((b) => b.reminderDate !== null)
    }

    // 6. Sort
    const sortBy = filters.sortBy ?? 'createdAt'
    const sortDir = filters.sortDir ?? 'desc'
    const dirMul = sortDir === 'asc' ? 1 : -1

    result = [...result].sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      // nulls: asc → nulls first, desc → nulls last
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDir === 'asc' ? -1 : 1
      if (bVal == null) return sortDir === 'asc' ? 1 : -1
      return aVal < bVal ? -1 * dirMul : aVal > bVal ? 1 * dirMul : 0
    })

    return result
  }, [optimisticBookmarks, selectedFolderId, deferredQuery, filters, folders])

  // Pagination
  const paginatedBookmarks = useMemo(
    () => !isFinite(pageSize)
      ? filteredBookmarks
      : filteredBookmarks.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredBookmarks, currentPage, pageSize],
  )

  // Reset to page 1 when filters / search / folder / pageSize change
  useEffect(() => {
    setCurrentPage(1)
  }, [deferredQuery, filters, selectedFolderId, pageSize])

  // Guard against current page going beyond total pages after bookmark deletions
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredBookmarks.length / pageSize))
    if (currentPage > maxPage) setCurrentPage(maxPage)
  }, [filteredBookmarks.length, currentPage, pageSize])

  // Refresh all bookmarks from server (used after mutations and SSE events)
  const fetchBookmarks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bookmarks?pageSize=500')
      if (!res.ok) throw new Error('Failed to fetch bookmarks')
      const data = await res.json()
      setBookmarks(data.bookmarks)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFolders = useCallback(async () => {
    const res = await fetch('/api/folders')
    if (res.ok) {
      setFolders(await res.json())
    }
  }, [])

  const fetchDomainPreferences = useCallback(async () => {
    try {
      const response = await fetch('/api/bookmarks/domain-grouping')
      if (response.ok) {
        const preferences = await response.json()
        setDomainPreferences(preferences)
      }
    } catch (error) {
      console.error('Failed to fetch domain preferences:', error)
    }
  }, [])

  const refreshFromServer = useCallback(async () => {
    await Promise.all([
      fetchBookmarks(),
      fetchFolders(),
      fetchDomainPreferences(),
    ])
  }, [fetchBookmarks, fetchFolders, fetchDomainPreferences])

  // Navigate to a folder and update breadcrumbs
  const navigateToFolder = useCallback((folderId: string | null | 'all') => {
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

    // No fetch needed — filteredBookmarks memo reacts to selectedFolderId change
  }, [folders])

  // Go back in breadcrumb navigation
  const goBackToParent = useCallback(() => {
    if (folderHierarchy.length > 1) {
      const parentLevel = folderHierarchy[folderHierarchy.length - 2]
      navigateToFolder(parentLevel.id)
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
  }

  const handleFiltersChange = (next: BookmarkFilters) => {
    setFilters(next)
    saveFilters(next)
    // No fetch needed — filteredBookmarks memo reacts to filters change
  }

  const handleFiltersReset = () => {
    handleFiltersChange(DEFAULT_FILTERS)
  }

  const handleDomainPreferenceChange = useCallback((domain: string, grouped: boolean) => {
    setDomainPreferences(prev => ({ ...prev, [domain]: grouped }))
  }, [])

  const handleBookmarkSaved = async () => {
    setBookmarkForm({ open: false })
    await Promise.all([fetchBookmarks(), fetchFolders()])
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

    startTransition(async () => {
      removeOptimisticBookmark(id)

      const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        alert('Could not delete bookmark. Please try again.')
        return
      }

      setBookmarks((prev) => prev.filter((b) => b.id !== id))
      await fetchFolders()
    })
  }

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Delete this folder? Bookmarks inside will be moved to "All bookmarks".')) return
    await fetch(`/api/folders/${id}`, { method: 'DELETE' })
    await Promise.all([fetchFolders(), fetchBookmarks()])

    // If the deleted folder is currently selected, navigate back to parent or "All bookmarks"
    if (selectedFolderId === id) {
      if (folderHierarchy.length > 1) {
        const parentLevel = folderHierarchy[folderHierarchy.length - 2]
        navigateToFolder(parentLevel.id)
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
      <aside
        aria-label="Navigation sidebar"
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-30 w-full transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 h-full ${
          sidebarCollapsed ? 'lg:w-0 lg:overflow-hidden' : 'lg:w-64'
        }`}
      >
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
      </aside>

      {/* Desktop sidebar collapse toggle — strip between sidebar and main content */}
      <button
        onClick={() => {
          const next = !sidebarCollapsed
          setSidebarCollapsed(next)
          localStorage.setItem('linkmine_sidebar_collapsed', String(next))
        }}
        className="hidden lg:flex shrink-0 items-center justify-center w-4 self-stretch bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          {sidebarCollapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          )}
        </svg>
      </button>

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
          <Pagination
            currentPage={currentPage}
            totalItems={filteredBookmarks.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}

        {(activeView === 'bookmarks') && (
          <FilterBar
            filters={filters}
            allTagsWithCounts={allTagsWithCounts}
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
                bookmarks={paginatedBookmarks}
                total={filteredBookmarks.length}
                loading={loading || isPending}
                folders={folders}
                domainPreferences={domainPreferences}
                onDomainPreferenceChange={handleDomainPreferenceChange}
                onEdit={(b) => setBookmarkForm({ open: true, bookmark: b })}
                onDelete={handleDeleteBookmark}
                showOldLinks={showOldLinks}
              />
            </div>
          ) : (
            <TagsIconsManager
              allTags={allTags}
              iconsInUse={iconsInUse.map((i) => i.icon)}
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
