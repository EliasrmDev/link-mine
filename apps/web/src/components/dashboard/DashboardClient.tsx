'use client'

import { useState, useCallback, useRef, useEffect, useMemo, useOptimistic, useTransition, useDeferredValue } from 'react'
import { X, FolderIcon } from 'lucide-react'
import type { Bookmark, Folder, BookmarkFilters } from '@linkmine/shared'
import { Sidebar } from './Sidebar'
import { BookmarkGrid } from './BookmarkGrid'
import { BookmarkForm } from './BookmarkForm'
import { FolderForm } from './FolderForm'
import { TopBar } from './TopBar'
import { FilterBar } from './FilterBar'
import { TagsIconsManager } from './TagsIconsManager'
import { ConfirmModal } from '../ui/ConfirmModal'
import { DeleteFolderModal } from '../ui/DeleteFolderModal'
import { Breadcrumb } from './Breadcrumb'
import { SubfolderGrid } from './SubfolderGrid'
import { SelectionToolbar } from './SelectionToolbar'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { getSmartFaviconUrl, handleFaviconError } from '@/lib/favicon'

const FILTERS_STORAGE_KEY = 'linkmine_filters'

const DEFAULT_FILTERS: BookmarkFilters = {
  sortBy: 'createdAt',
  sortDir: 'desc',
  tags: [],
  hasReminder: false,
}

const SSE_REFRESH_DEBOUNCE_MS = 200

// ─── Recursive folder tree helpers ───────────────────────────────────────────

/** Find a folder anywhere in the recursive tree by id. */
function findFolderById(folders: Folder[], id: string): Folder | undefined {
  for (const folder of folders) {
    if (folder.id === id) return folder
    if (folder.children?.length) {
      const found = findFolderById(folder.children, id)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Return the path from root down to the target folder (inclusive).
 * Returns an empty array if not found.
 */
function getFolderAncestorPath(folders: Folder[], targetId: string): Folder[] {
  for (const folder of folders) {
    if (folder.id === targetId) return [folder]
    if (folder.children?.length) {
      const sub = getFolderAncestorPath(folder.children, targetId)
      if (sub.length) return [folder, ...sub]
    }
  }
  return []
}

/** Collect the ids of a folder and all its descendants. */
function collectDescendantIds(folder: Folder, ids: Set<string> = new Set()): Set<string> {
  ids.add(folder.id)
  for (const child of folder.children ?? []) {
    collectDescendantIds(child, ids)
  }
  return ids
}

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
  /** Dashboard preferences fetched from DB (overrides localStorage) */
  initialDashboardPrefs: Record<string, string>
  user: { name: string; image: string | null }
}

export function DashboardClient({ initialBookmarks, initialFolders, initialTagsWithCounts, initialIconsWithCounts, initialDomainPreferences, initialDashboardPrefs, user }: Props) {
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
  type SidebarMode = 'toggle' | 'hover'
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    // DB value takes precedence over localStorage
    const fromDB = initialDashboardPrefs['dashboard:sidebar_mode']
    if (fromDB === 'hover' || fromDB === 'toggle') return fromDB
    if (typeof window === 'undefined') return 'toggle'
    const stored = localStorage.getItem('linkmine_sidebar_mode')
    if (stored === 'hover') return 'hover'
    return 'toggle'
  })
  const [sidebarToggleExpanded, setSidebarToggleExpanded] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('linkmine_sidebar_mode') !== 'collapsed'
  })
  const [sidebarHovered, setSidebarHovered] = useState(false)

  const sidebarExpanded = sidebarMode === 'toggle' ? sidebarToggleExpanded : sidebarHovered

  const handleSidebarModeChange = (mode: SidebarMode) => {
    setSidebarMode(mode)
    setSidebarToggleExpanded(true)
    localStorage.setItem('linkmine_sidebar_mode', mode)
  }
  const handleToggleSidebar = () => setSidebarToggleExpanded((e) => !e)
  const [pageSize, setPageSize] = useState(Infinity)
  const [currentPage, setCurrentPage] = useState(1)

  // Masonry (columns) layout toggle — persisted to localStorage
  const [masonryEnabled, setMasonryEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('linkmine_masonry') !== 'false' } catch { return true }
  })
  const toggleMasonry = useCallback(() => {
    setMasonryEnabled((v) => {
      const next = !v
      try { localStorage.setItem('linkmine_masonry', next ? 'true' : 'false') } catch { /* ignore */ }
      return next
    })
  }, [])

  // Selection state for bulk operations
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(new Set())
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)

  const toggleBookmarkSelection = useCallback((id: string) => {
    setSelectedBookmarkIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  const selectBookmarkRange = useCallback((ids: string[]) => {
    setSelectedBookmarkIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
  }, [])

  const toggleGroupBookmarkSelection = useCallback((ids: string[]) => {
    setSelectedBookmarkIds((prev) => {
      const next = new Set(prev)
      const allSelected = ids.every((id) => prev.has(id))
      if (allSelected) {
        for (const id of ids) next.delete(id)
      } else {
        for (const id of ids) next.add(id)
      }
      return next
    })
  }, [])

  const selectAllBookmarks = useCallback((ids: string[]) => {
    setSelectedBookmarkIds(new Set(ids))
  }, [])

  const toggleFolderSelection = useCallback((id: string) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedBookmarkIds(new Set())
    setSelectedFolderIds(new Set())
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    clearSelection()
  }, [clearSelection])

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  // Disable DnD on touch-only devices (mobile) to avoid conflicts with scrolling
  const isTouchOnly = typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const [draggedBookmark, setDraggedBookmark] = useState<Bookmark | null>(null)
  const [draggedFolder, setDraggedFolder] = useState<{ name: string } | null>(null)
  const [movingBookmarkId, setMovingBookmarkId] = useState<string | null>(null)
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null)
  const [activeDragFolderId, setActiveDragFolderId] = useState<string | null>(null)

  // IDs that cannot be drop targets during a folder drag (self + all descendants)
  const invalidFolderDropIds = useMemo(() => {
    if (!activeDragFolderId) return null
    const dragged = findFolderById(folders, activeDragFolderId)
    if (!dragged) return new Set([activeDragFolderId])
    return collectDescendantIds(dragged)
  }, [activeDragFolderId, folders])
  // Ref so handleDragEnd always sees the latest set without stale-closure issues
  const invalidFolderDropIdsRef = useRef<Set<string> | null>(null)
  invalidFolderDropIdsRef.current = invalidFolderDropIds

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setDraggedBookmark(null)
    setDraggedFolder(null)
    setActiveDragFolderId(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as {
      type: string
      id: string
      folderId?: string | null
      parentId?: string | null
    } | undefined
    if (!activeData) return

    const overId = over.id as string

    // ── Folder move ─────────────────────────────────────────────────────────
    if (activeData.type === 'folder') {
      let targetParentId: string | null
      if (overId === 'drop:unsorted') {
        targetParentId = null
      } else if (overId.startsWith('folder:')) {
        const targetId = overId.slice('folder:'.length)
        if (targetId === activeData.id) return // drop on self
        targetParentId = targetId
      } else {
        return
      }
      // No-op if already at this parent
      if (targetParentId === (activeData.parentId ?? null)) return
      // Guard: never move into self or a descendant (belt-and-suspenders client check)
      if (targetParentId && invalidFolderDropIdsRef.current?.has(targetParentId)) return
      setMovingFolderId(activeData.id)
      try {
        const res = await fetch(`/api/folders/${activeData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: targetParentId }),
        })
        if (!res.ok) {
          console.error('Folder move failed', await res.text())
          return
        }
        const foldersRes = await fetch('/api/folders')
        if (foldersRes.ok) setFolders(await foldersRes.json())
      } catch (err) {
        console.error('Folder move error', err)
      } finally {
        setMovingFolderId(null)
      }
      return
    }

    // ── Bookmark move ────────────────────────────────────────────────────────
    if (activeData.type !== 'bookmark') return

    let targetFolderId: string | null | undefined
    if (overId === 'drop:unsorted') {
      targetFolderId = null
    } else if (overId.startsWith('folder:')) {
      targetFolderId = overId.slice('folder:'.length)
    } else {
      return // dropped on unknown target
    }

    // No-op if dropped on current folder
    if (targetFolderId === activeData.folderId) return

    // Trigger the "being moved" animation on the card
    setMovingBookmarkId(activeData.id)

    try {
      const res = await fetch(`/api/bookmarks/${activeData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: targetFolderId }),
      })
      if (!res.ok) {
        setMovingBookmarkId(null)
        console.error('DnD move failed', await res.text())
        return
      }
      const updated: Bookmark = await res.json()
      setBookmarks((prev) => prev.map((b) => b.id === updated.id ? updated : b))
    } catch (err) {
      console.error('DnD move error', err)
    } finally {
      // Clear animation id after it completes (~400ms keyframe duration + small buffer)
      setTimeout(() => setMovingBookmarkId(null), 450)
    }
  }, [])

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
    bulkBookmarkIds?: string[]
    bulkFolderIds?: string[]
  }>({ open: false })

  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<{
    open: boolean
    folderId?: string
    folderName?: string
    hasContents?: boolean
  }>({ open: false })
  const [returnToBookmarkAfterFolder, setReturnToBookmarkAfterFolder] = useState(false)

  const sseRefreshTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // Load persisted filters on mount (DB sort pref takes precedence over localStorage)
  useEffect(() => {
    const loaded = loadFilters()
    const dbSort = initialDashboardPrefs['dashboard:sort']
    if (dbSort) {
      const [sortBy, sortDir] = dbSort.split('|')
      const allowedSortBy = ['createdAt', 'reminderDate', 'lastAccessed'] as const
      type SortBy = typeof allowedSortBy[number]
      const validatedSortBy = allowedSortBy.includes(sortBy as SortBy) ? (sortBy as SortBy) : loaded.sortBy
      setFilters({ ...loaded, sortBy: validatedSortBy, sortDir: (sortDir as 'asc' | 'desc') ?? loaded.sortDir })
    } else {
      setFilters(loaded)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Collect all unique tags with usage counts (global — for TagsIconsManager suggestions)
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

  // Global icons in use (for TagsIconsManager)
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

  // Bookmarks scoped to the current view context (folder/unsorted/all), before other filters.
  // Used to derive context-aware tags and icons for the FilterBar.
  const contextBookmarks = useMemo(() => {
    if (selectedFolderId === 'none') {
      return optimisticBookmarks.filter((b) => !b.folderId)
    }
    if (selectedFolderId && selectedFolderId !== 'all') {
      const targetFolder = findFolderById(folders, selectedFolderId)
      const folderIds = targetFolder
        ? collectDescendantIds(targetFolder)
        : new Set([selectedFolderId])
      return optimisticBookmarks.filter((b) => b.folderId && folderIds.has(b.folderId))
    }
    return optimisticBookmarks
  }, [optimisticBookmarks, selectedFolderId, folders])

  // Tags available in the current context (for FilterBar)
  const contextTagsWithCounts = useMemo(() => {
    const counts = new Map<string, number>()
    contextBookmarks.forEach((b) => b.tags.forEach((t) => {
      const tag = t.trim().toLowerCase()
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }))
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [contextBookmarks])

  // Icons available in the current context (for FilterBar)
  const contextIconsInUse = useMemo(() => {
    const counts = new Map<string, number>()
    contextBookmarks.forEach((b) => {
      if (b.icon && !isAutomaticFavicon(b.icon, b.url)) {
        counts.set(b.icon, (counts.get(b.icon) ?? 0) + 1)
      }
    })
    return Array.from(counts.entries())
      .map(([icon, count]) => ({ icon, count }))
      .sort((a, b) => b.count - a.count)
  }, [contextBookmarks])

  // Derive unsorted count from all bookmarks (no separate API call needed)
  const unsortedCount = useMemo(
    () => bookmarks.filter((b) => !b.folderId).length,
    [bookmarks],
  )

  // Live per-folder bookmark counts derived from local bookmarks state.
  // Stays in sync immediately after DnD moves (no re-fetch needed).
  const bookmarkCountByFolderId = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of bookmarks) {
      if (b.folderId) map.set(b.folderId, (map.get(b.folderId) ?? 0) + 1)
    }
    return map
  }, [bookmarks])

  // Client-side filtering: view → search → tags → icon → reminder → sort
  // Reads from optimisticBookmarks so optimistic deletes are reflected instantly
  const filteredBookmarks = useMemo(() => {
    let result = optimisticBookmarks

    // 1. View filter (folder selection)
    if (selectedFolderId === 'none') {
      result = result.filter((b) => !b.folderId)
    } else if (selectedFolderId && selectedFolderId !== 'all') {
      // Show only bookmarks directly in this folder (not descendants)
      result = result.filter((b) => b.folderId === selectedFolderId)
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
      const path = getFolderAncestorPath(folders, folderId)
      if (path.length > 0) {
        const targetFolder = path[path.length - 1]
        setFolderHierarchy([
          { id: 'all', name: 'All bookmarks' },
          ...path.map((f) => ({ id: f.id, name: f.name })),
        ])
        setCurrentSubfolders(targetFolder.children ?? [])
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

  // When the folder list refreshes (e.g. after a rename), re-sync breadcrumb
  // names and the current subfolder list without changing the selected folder.
  useEffect(() => {
    setFolderHierarchy((prev) =>
      prev.map((item) => {
        if (item.id === 'all' || item.id === 'none') return item
        const fresh = findFolderById(folders, item.id as string)
        return fresh ? { id: fresh.id, name: fresh.name } : item
      }),
    )
  }, [folders])

  useEffect(() => {
    if (!selectedFolderId || selectedFolderId === 'all' || selectedFolderId === 'none') return
    const fresh = findFolderById(folders, selectedFolderId)
    if (fresh) setCurrentSubfolders(fresh.children ?? [])
  }, [folders, selectedFolderId])

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

    const onBookmarksBulkDeleted = () => { scheduleRefresh() }

    es.addEventListener('bookmark:saved', onBookmarkSaved)
    es.addEventListener('bookmark:deleted', onBookmarkDeleted)
    es.addEventListener('bookmarks:bulk-deleted', onBookmarksBulkDeleted)
    es.addEventListener('folders:changed', onFoldersChanged)

    return () => {
      if (sseRefreshTimeout.current) clearTimeout(sseRefreshTimeout.current)
      es.removeEventListener('bookmark:saved', onBookmarkSaved)
      es.removeEventListener('bookmark:deleted', onBookmarkDeleted)
      es.removeEventListener('bookmarks:bulk-deleted', onBookmarksBulkDeleted)
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

  const handleGroupBulkDelete = useCallback((ids: string[], domain: string) => {
    setDeleteConfirm({
      open: true,
      bulkBookmarkIds: ids,
      bookmarkTitle: `all ${ids.length} bookmarks from ${domain}`,
    })
  }, [])

  const doDeleteBookmark = async () => {
    const id = deleteConfirm.bookmarkId
    const bulkBookmarkIds = deleteConfirm.bulkBookmarkIds
    const bulkFolderIds = deleteConfirm.bulkFolderIds
    setDeleteConfirm({ open: false })

    // Bulk delete path
    if (bulkBookmarkIds || bulkFolderIds) {
      startTransition(async () => {
        const promises: Promise<Response>[] = []
        if (bulkBookmarkIds?.length) {
          // Optimistically remove from UI
          setBookmarks((prev) => prev.filter((b) => !bulkBookmarkIds.includes(b.id)))
          promises.push(
            fetch('/api/bookmarks/bulk-delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: bulkBookmarkIds }),
            }),
          )
        }
        if (bulkFolderIds?.length) {
          promises.push(
            fetch('/api/folders/bulk-delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: bulkFolderIds }),
            }),
          )
        }
        const results = await Promise.all(promises)
        if (results.some((r) => !r.ok)) {
          alert('Some items could not be deleted. Please try again.')
        }
        await Promise.all([fetchBookmarks(), fetchFolders()])
        exitSelectionMode()
      })
      return
    }

    // Single delete path
    if (!id) return

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

  const handleBulkDelete = useCallback(() => {
    const bIds = Array.from(selectedBookmarkIds)
    const fIds = Array.from(selectedFolderIds)
    const bookmarkCount = bIds.length
    const folderCount = fIds.length

    const parts: string[] = []
    if (bookmarkCount > 0) parts.push(`${bookmarkCount} bookmark${bookmarkCount !== 1 ? 's' : ''}`)
    if (folderCount > 0) parts.push(`${folderCount} folder${folderCount !== 1 ? 's' : ''} (and all their contents)`)

    setDeleteConfirm({
      open: true,
      bulkBookmarkIds: bIds.length > 0 ? bIds : undefined,
      bulkFolderIds: fIds.length > 0 ? fIds : undefined,
      bookmarkTitle: `${parts.join(' and ')}`,
    })
  }, [selectedBookmarkIds, selectedFolderIds])

  const handleDeleteFolder = (id: string) => {
    // Find the folder in the tree to determine its name and whether it has contents.
    const findFolder = (list: Folder[], target: string): Folder | null => {
      for (const f of list) {
        if (f.id === target) return f
        if (f.children?.length) {
          const found = findFolder(f.children, target)
          if (found) return found
        }
      }
      return null
    }

    const folder = findFolder(folders, id)
    const hasSubFolders = (folder?.children?.length ?? 0) > 0
    const hasBookmarks = bookmarks.some((b) => b.folderId === id)

    setDeleteFolderConfirm({
      open: true,
      folderId: id,
      folderName: folder?.name ?? 'this folder',
      hasContents: hasSubFolders || hasBookmarks,
    })
  }

  const doDeleteFolder = async (mode: 'cascade' | 'folder-only') => {
    const id = deleteFolderConfirm.folderId
    setDeleteFolderConfirm({ open: false })
    if (!id) return

    const url = mode === 'folder-only'
      ? `/api/folders/${id}?mode=folder-only`
      : `/api/folders/${id}`

    await fetch(url, { method: 'DELETE' })
    await Promise.all([fetchFolders(), fetchBookmarks()])

    if (selectedFolderId === id) {
      if (folderHierarchy.length > 1) {
        navigateToFolder(folderHierarchy[folderHierarchy.length - 2].id)
      } else {
        navigateToFolder('all')
      }
    }
  }

  // Tags and Icons Management
  const handleBulkDeleteFolders = async (ids: string[]) => {
    if (ids.length === 0) return
    await fetch('/api/folders/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    await Promise.all([fetchFolders(), fetchBookmarks()])
    if (typeof selectedFolderId === 'string' && ids.includes(selectedFolderId)) {
      navigateToFolder('all')
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

  // Show old-links section only when not actively filtering/searching
  const showOldLinks = !query && !(filters.tags?.length) && !filters.icon

  return (
    <DndContext
      sensors={isTouchOnly ? [] : dndSensors}
      collisionDetection={pointerWithin}
      onDragStart={(event) => {
        const data = event.active.data.current as { type: string; id: string; name?: string } | undefined
        if (data?.type === 'bookmark') {
          setDraggedBookmark(bookmarks.find((b) => b.id === data.id) ?? null)
        } else if (data?.type === 'folder') {
          setDraggedFolder({ name: data.name ?? '' })
          setActiveDragFolderId(data.id)
        }
      }}
      onDragEnd={handleDragEnd}
    >
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
          sidebarExpanded ? 'lg:w-64' : 'lg:w-14'
        }`}
        onMouseEnter={() => { if (sidebarMode === 'hover') setSidebarHovered(true) }}
        onMouseLeave={() => { if (sidebarMode === 'hover') setSidebarHovered(false) }}
      >
        <div className="relative h-full">
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 right-4 z-40 lg:hidden p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className={`h-full ${sidebarMode === 'hover' ? 'lg:absolute lg:top-0 lg:left-0 lg:z-40' : ''} ${sidebarMode === 'hover' && sidebarHovered ? 'lg:shadow-xl' : ''}`}
          >
            <Sidebar
              user={user}
              folders={folders}
              unsortedCount={unsortedCount}
              bookmarkCountByFolderId={bookmarkCountByFolderId}
              selectedFolderId={selectedFolderId}
              onSelectFolder={(id) => {
                navigateToFolder(id)
                setSidebarOpen(false) // Close sidebar on mobile after selection
              }}
              onAddFolder={(parentId) => setFolderForm({ open: true, parentId })}
              onEditFolder={(folder) => setFolderForm({ open: true, folder })}
              onDeleteFolder={handleDeleteFolder}
              onBulkDeleteFolders={handleBulkDeleteFolders}
              movingFolderId={movingFolderId}
              invalidFolderDropIds={invalidFolderDropIds ?? undefined}
              sidebarMode={sidebarMode}
              onSidebarModeChange={handleSidebarModeChange}
              sidebarExpanded={sidebarExpanded}
              onToggleSidebar={handleToggleSidebar}
            />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden lg:ml-0">
        <TopBar
          query={query}
          onSearch={handleSearch}
          onAddBookmark={() => setBookmarkForm({ open: true })}
          activeView={activeView}
          currentPage={currentPage}
          totalItems={filteredBookmarks.length}
          pageSize={pageSize}
          onViewChange={setActiveView}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          selectionMode={selectionMode}
          onToggleSelectionMode={() => {
            if (selectionMode) { exitSelectionMode() } else { setSelectionMode(true) }
          }}
        />

        {(activeView === 'bookmarks') && (
          <FilterBar
            filters={filters}
            allTagsWithCounts={contextTagsWithCounts}
            iconsInUse={contextIconsInUse}
            onChange={handleFiltersChange}
            onReset={handleFiltersReset}
            selectionMode={selectionMode}
            allSelected={filteredBookmarks.length > 0 && filteredBookmarks.every((b) => selectedBookmarkIds.has(b.id))}
            onSelectAll={() => selectAllBookmarks(filteredBookmarks.map((b) => b.id))}
            onDeselectAll={clearSelection}
            masonryEnabled={masonryEnabled}
            onToggleMasonry={toggleMasonry}
          />
        )}

        <main className={`flex-1 overflow-y-auto ${activeView === 'bookmarks' ? 'p-3 sm:p-6' : 'py-1'} scrollbar-stable`} id="main-content">
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
                  selectionMode={selectionMode}
                  selectedFolderIds={selectedFolderIds}
                  onToggleFolderSelect={toggleFolderSelection}
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
                onBulkDelete={handleGroupBulkDelete}
                showOldLinks={showOldLinks}
                masonryEnabled={masonryEnabled}
                initialBordersEnabled={
                  initialDashboardPrefs['dashboard:borders_global'] !== undefined
                    ? initialDashboardPrefs['dashboard:borders_global'] !== 'false'
                    : undefined
                }
                selectionMode={selectionMode}
                selectedIds={selectedBookmarkIds}
                onToggleSelect={toggleBookmarkSelection}
                onToggleGroupSelect={toggleGroupBookmarkSelection}
                onSelectRange={selectBookmarkRange}
                movingBookmarkId={movingBookmarkId}
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

      {/* Selection toolbar */}
      <SelectionToolbar
        selectedBookmarks={selectedBookmarkIds.size}
        selectedFolders={selectedFolderIds.size}
        onDelete={handleBulkDelete}
        onClear={exitSelectionMode}
      />

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
          title={deleteConfirm.bulkBookmarkIds || deleteConfirm.bulkFolderIds ? 'Delete selected items?' : 'Delete bookmark?'}
          description={
            deleteConfirm.bulkBookmarkIds || deleteConfirm.bulkFolderIds
              ? `${deleteConfirm.bookmarkTitle} will be permanently deleted. This cannot be undone.`
              : deleteConfirm.bookmarkTitle
                ? `"${deleteConfirm.bookmarkTitle}" will be permanently removed.`
                : 'This bookmark will be permanently removed.'
          }
          confirmLabel="Delete"
          destructive
          onConfirm={doDeleteBookmark}
          onCancel={() => setDeleteConfirm({ open: false })}
        />
      )}

      {deleteFolderConfirm.open && (
        <DeleteFolderModal
          folderName={deleteFolderConfirm.folderName ?? 'this folder'}
          hasContents={deleteFolderConfirm.hasContents ?? false}
          onFolderOnly={() => doDeleteFolder('folder-only')}
          onCascade={() => doDeleteFolder('cascade')}
          onCancel={() => setDeleteFolderConfirm({ open: false })}
        />
      )}
    </div>

    {/* DragOverlay: floating card that follows the cursor exactly */}
    <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
      {draggedBookmark ? (() => {
        const domain = (() => { try { return new URL(draggedBookmark.url).hostname } catch { return '' } })()
        const faviconUrl = getSmartFaviconUrl(draggedBookmark.url, domain)
        return (
          <div className="card flex items-center gap-3 px-4 py-3 shadow-2xl ring-2 ring-brand-400 bg-white dark:bg-gray-800 w-12 pointer-events-none">
            {faviconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faviconUrl}
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 shrink-0 rounded"
                onError={(e) => handleFaviconError(e, draggedBookmark.url, domain)}
              />
            )}
          </div>
        )
      })() : draggedFolder ? (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 shadow-xl ring-2 ring-brand-400 text-sm font-medium text-gray-700 dark:text-gray-300 pointer-events-none">
          <FolderIcon className="h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
          <span>{draggedFolder.name}</span>
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}
