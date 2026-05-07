'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Group, Palette, SquarePen, Trash2, Ungroup } from 'lucide-react'
import type { Bookmark, Folder, DomainGroupedBookmark, TreeNodeData } from '@linkmine/shared'
import TreeView from '@/components/dashboard/TreeView'
import { useDraggable } from '@dnd-kit/core'
import { getSmartFaviconUrl, handleFaviconError } from '@/lib/favicon'

const STALE_DAYS = 30

// Deterministic hue from domain string for unique group colors
function domainHue(domain: string): number {
  let hash = 0
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash)
  }
  return ((hash % 360) + 360) % 360
}

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

// Group bookmarks by domain for nested display
function groupBookmarksByDomain(
  bookmarks: Bookmark[],
  domainPreferences: Record<string, boolean>
): { grouped: DomainGroupedBookmark[]; individual: DomainGroupedBookmark[]; domainCounts: Record<string, number> } {
  const domainGroups = new Map<string, Bookmark[]>()
  const ungrouped: DomainGroupedBookmark[] = []
  const domainCounts: Record<string, number> = {}

  // Group bookmarks by domain
  for (const bookmark of bookmarks) {
    try {
      const url = new URL(bookmark.url)
      const domain = url.hostname

      // Count bookmarks per domain
      domainCounts[domain] = (domainCounts[domain] || 0) + 1

      // Check if this domain should be grouped (default: true)
      const shouldGroup = domainPreferences[domain] !== false

      if (shouldGroup) {
        if (!domainGroups.has(domain)) {
          domainGroups.set(domain, [])
        }
        domainGroups.get(domain)!.push(bookmark)
      } else {
        ungrouped.push({ ...bookmark, domain })
      }
    } catch {
      // Invalid URL - treat as ungrouped
      ungrouped.push({ ...bookmark, domain: '' })
    }
  }

  const grouped: DomainGroupedBookmark[] = []
  const individual: DomainGroupedBookmark[] = []

  // Convert grouped domains to parent/child structure
  for (const [domain, domainBookmarks] of domainGroups) {
    if (domainBookmarks.length < 2) {
      // Single bookmark - treat as individual
      individual.push(...domainBookmarks.map(b => ({ ...b, domain })))
    } else {
      // Multiple bookmarks - create parent with children
      const sortedBookmarks = domainBookmarks.sort((a, b) => {
        // Prioritize homepage URLs (root domain)
        const aIsRoot = isRootDomain(a.url)
        const bIsRoot = isRootDomain(b.url)

        if (aIsRoot && !bIsRoot) return -1
        if (!aIsRoot && bIsRoot) return 1

        // Sort by creation date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      const parent = sortedBookmarks[0]
      const children = sortedBookmarks.slice(1)

      grouped.push({
        ...parent,
        domain,
        isParent: true,
        children,
      })
    }
  }

  return {
    grouped,
    individual: [...individual, ...ungrouped],
    domainCounts
  }
}

function isRootDomain(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname
    return path === '/' || path === ''
  } catch {
    return false
  }
}

// Build a URL-path-based tree from a grouped bookmark (parent + flat children).
// Uses a trie keyed on path segments so that:
//  - A node is a parent only when at least one other URL has it as a strict prefix path.
//  - Sibling URLs (same domain, non-overlapping paths) appear at the same nesting level.
function buildTreeFromBookmarks(parent: DomainGroupedBookmark): TreeNodeData[] {
  const allBookmarks = [parent, ...(parent.children ?? [])]

  // Normalise each bookmark to a path-segment array (strip trailing slash)
  const entries = allBookmarks.map((b) => {
    let segments: string[] = []
    try {
      const u = new URL(b.url)
      segments = u.pathname.replace(/\/$/, '').split('/').filter(Boolean)
    } catch { /* keep empty */ }
    return { bookmark: b, segments }
  })

  // Trie node
  interface TrieNode {
    segment: string
    bookmark?: DomainGroupedBookmark | typeof allBookmarks[number]
    children: Map<string, TrieNode>
  }

  const root: TrieNode = { segment: '', children: new Map() }

  for (const { bookmark: bm, segments } of entries) {
    let node = root
    for (const seg of segments) {
      if (!node.children.has(seg)) {
        node.children.set(seg, { segment: seg, children: new Map() })
      }
      node = node.children.get(seg)!
    }
    node.bookmark = bm
  }

  // Collapse intermediate trie nodes that have no bookmark and only one child
  // so we don't show empty path-segment nodes.
  function collapseNode(node: TrieNode): TrieNode {
    if (!node.bookmark && node.children.size === 1) {
      const [child] = node.children.values()
      const collapsed = collapseNode(child)
      // Merge segment labels for display purposes (not needed for logic)
      return { ...collapsed, segment: node.segment ? `${node.segment}/${collapsed.segment}` : collapsed.segment }
    }
    const newChildren = new Map<string, TrieNode>()
    for (const [k, child] of node.children) {
      newChildren.set(k, collapseNode(child))
    }
    return { ...node, children: newChildren }
  }

  const collapsedRoot = collapseNode(root)

  // Convert trie to TreeNodeData
  function trieToTree(node: TrieNode): TreeNodeData | null {
    if (!node.bookmark && node.children.size === 0) return null
    const bm = node.bookmark
    const childNodes: TreeNodeData[] = []
    for (const child of node.children.values()) {
      const t = trieToTree(child)
      if (t) childNodes.push(t)
    }

    if (!bm) {
      if (childNodes.length === 0) return null
      if (childNodes.length === 1) return childNodes[0]
      // Intermediate path segment with multiple children → virtual path-folder accordion
      const seg = node.segment || ''
      return {
        id: `__path__${seg}`,
        title: `/${seg}/`,
        defaultExpanded: true,
        children: childNodes,
      }
    }

    const treeNode: TreeNodeData = {
      id: bm.id,
      title: bm.title,
      href: bm.url,
      defaultExpanded: bm.id === parent.id, // expand root by default
      ...(childNodes.length > 0 ? { children: childNodes } : {}),
    }
    return treeNode
  }

  // The real root is the trie's child that corresponds to the parent bookmark.
  // Collect all top-level trie children as forest roots.
  const forest: TreeNodeData[] = []
  for (const child of collapsedRoot.children.values()) {
    const t = trieToTree(child)
    if (t) forest.push(t)
  }

  // If the root trie itself has a bookmark (path = '/'), prepend it
  if (collapsedRoot.bookmark) {
    const rootNode = trieToTree(collapsedRoot)
    if (rootNode) forest.unshift(rootNode)
  }

  // Fallback: if trie produced nothing, just return flat list
  if (forest.length === 0) {
    return allBookmarks.map((b, i) => ({
      id: b.id,
      title: b.title,
      href: b.url,
      defaultExpanded: i === 0,
    }))
  }

  return forest
}



// ── DOMVector — magnitude + direction for drag interactions ────────────────
// Based on https://www.joshuawootonn.com/react-drag-to-select
// A vector with start point (x, y) and signed magnitude (magnitudeX, magnitudeY).
// Unlike DOMRect, magnitudes can be negative (drag left/up), which prevents the
// anchor point from jumping when the user drags back past the origin.
class DOMVector {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly magnitudeX: number,
    readonly magnitudeY: number,
  ) {}

  /** Combine two vectors (used to merge dragVector + scrollVector). */
  add(v: DOMVector): DOMVector {
    return new DOMVector(
      this.x + v.x,
      this.y + v.y,
      this.magnitudeX + v.magnitudeX,
      this.magnitudeY + v.magnitudeY,
    )
  }

  /** Pythagorean distance — used for the drag-start threshold. */
  getDiagonalLength(): number {
    return Math.sqrt(Math.pow(this.magnitudeX, 2) + Math.pow(this.magnitudeY, 2))
  }

  /** Tip of the vector — used for auto-scroll edge detection. */
  toTerminalPoint(): DOMPoint {
    return new DOMPoint(this.x + this.magnitudeX, this.y + this.magnitudeY)
  }

  /** Convert to a normalised DOMRect (non-negative width/height). */
  toDOMRect(): DOMRect {
    return new DOMRect(
      Math.min(this.x, this.x + this.magnitudeX),
      Math.min(this.y, this.y + this.magnitudeY),
      Math.abs(this.magnitudeX),
      Math.abs(this.magnitudeY),
    )
  }
}

interface Props {
  bookmarks: Bookmark[]
  total: number
  loading: boolean
  folders: Folder[]
  domainPreferences: Record<string, boolean>
  onDomainPreferenceChange: (domain: string, grouped: boolean) => void
  onEdit: (bookmark: Bookmark) => void
  onDelete: (id: string) => void
  onBulkDelete?: (ids: string[], domain: string) => void
  showOldLinks?: boolean
  /** Initial value from DB; takes precedence over localStorage */
  initialBordersEnabled?: boolean
  // Selection
  selectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  /** Toggle selection for a whole group (parent + all children) */
  onToggleGroupSelect?: (ids: string[]) => void
  /** Batch-select multiple bookmarks (lasso / rubber-band selection) */
  onSelectRange?: (ids: string[]) => void
  /** Bookmark id that is currently being moved via DnD — plays the move animation */
  movingBookmarkId?: string | null
}

export function BookmarkGrid({ bookmarks, total, loading, domainPreferences, onDomainPreferenceChange, onEdit, onDelete, onBulkDelete, showOldLinks, initialBordersEnabled, selectionMode = false, selectedIds = new Set(), onToggleSelect, onToggleGroupSelect, onSelectRange, movingBookmarkId }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [loadingPreferences, setLoadingPreferences] = useState(false)
  const pendingGroupingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Rubber-band (lasso) selection ─────────────────────────────────────────
  // dragVector is stored in absolute-to-container coordinates:
  //   x/y          = anchor (initial click point relative to container top-left)
  //   magnitudeX/Y = current pointer − anchor, in the same coordinate space
  //
  // Using container-relative coords means the overlay is position:absolute and
  // the anchor pixel never shifts — only the magnitude (size) changes.
  // As #main-content scrolls, getBoundingClientRect().top decreases, so the same
  // clientY maps to a larger absY, naturally extending the rect downward.
  // No separate scrollVector is needed.
  const [dragVector, setDragVector] = useState<DOMVector | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const dragVectorRef = useRef<DOMVector | null>(null)
  const isDraggingRef = useRef(false)
  // Fixed anchor in container-relative coords — set once on pointerDown, never updated
  const anchorAbsRef = useRef({ x: 0, y: 0 })
  // Last known viewport (client) coords — for onScroll recompute + auto-scroll edge detection
  const lastClientRef = useRef({ x: 0, y: 0 })

  // Cache the scroll container once on mount
  useEffect(() => {
    scrollContainerRef.current = document.getElementById('main-content') ?? document.documentElement
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectionMode || e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-bookmark-id]')) return
    const rect = containerRef.current!.getBoundingClientRect()
    const anchorX = e.clientX - rect.left
    const anchorY = e.clientY - rect.top
    anchorAbsRef.current = { x: anchorX, y: anchorY }
    lastClientRef.current = { x: e.clientX, y: e.clientY }
    const dv = new DOMVector(anchorX, anchorY, 0, 0)
    dragVectorRef.current = dv
    isDraggingRef.current = false
    setDragVector(dv)
    setIsDragging(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [selectionMode])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragVectorRef.current == null || containerRef.current == null) return
    lastClientRef.current = { x: e.clientX, y: e.clientY }
    const rect = containerRef.current.getBoundingClientRect()
    const curAbsX = e.clientX - rect.left
    const curAbsY = e.clientY - rect.top
    const { x: anchorX, y: anchorY } = anchorAbsRef.current
    const nextDV = new DOMVector(anchorX, anchorY, curAbsX - anchorX, curAbsY - anchorY)
    // Only commit to a drag after the pointer has moved ≥ 10 px (prevents
    // accidental selection when the user just clicks a card-free area).
    if (!isDraggingRef.current && nextDV.getDiagonalLength() < 10) return
    isDraggingRef.current = true
    dragVectorRef.current = nextDV
    setDragVector(nextDV)
    setIsDragging(true)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (dragVectorRef.current == null) return
    if (isDraggingRef.current && containerRef.current) {
      const selRect = dragVectorRef.current.toDOMRect()
      const containerRect = containerRef.current.getBoundingClientRect()
      const ids: string[] = []
      containerRef.current.querySelectorAll('[data-bookmark-id]').forEach((card) => {
        const r = card.getBoundingClientRect()
        // Convert card viewport rect → container-relative coords for intersection test
        const cl = r.left   - containerRect.left
        const ct = r.top    - containerRect.top
        const cr = r.right  - containerRect.left
        const cb = r.bottom - containerRect.top
        if (cl < selRect.right && cr > selRect.left && ct < selRect.bottom && cb > selRect.top) {
          const el = card as HTMLElement
          const id = el.dataset.bookmarkId
          if (id) {
            ids.push(id)
            // If this is a group card, also include all children
            const childrenAttr = el.dataset.bookmarkChildren
            if (childrenAttr) ids.push(...childrenAttr.split(',').filter(Boolean))
          }
        }
      })
      if (ids.length > 0) onSelectRange?.(ids)
    }
    dragVectorRef.current = null
    isDraggingRef.current = false
    setDragVector(null)
    setIsDragging(false)
  }, [onSelectRange])

  // When #main-content scrolls during a drag, recompute the vector using the last
  // known client coords + the updated getBoundingClientRect() (shifts as page scrolls).
  useEffect(() => {
    if (!selectionMode) return
    const scrollEl = scrollContainerRef.current
    if (!scrollEl) return
    function onScroll() {
      if (!isDraggingRef.current || containerRef.current == null) return
      const rect = containerRef.current.getBoundingClientRect()
      const { x: clientX, y: clientY } = lastClientRef.current
      const curAbsX = clientX - rect.left
      const curAbsY = clientY - rect.top
      const { x: anchorX, y: anchorY } = anchorAbsRef.current
      const nextDV = new DOMVector(anchorX, anchorY, curAbsX - anchorX, curAbsY - anchorY)
      dragVectorRef.current = nextDV
      setDragVector(nextDV)
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [selectionMode])

  // Auto-scroll #main-content when the pointer is within 20 px of its edges.
  // Uses lastClientRef (viewport coords) for edge detection.
  // The resulting scroll fires onScroll above, which keeps dragVector in sync.
  useEffect(() => {
    if (!isDragging || scrollContainerRef.current == null) return

    let handle = requestAnimationFrame(scrollTheLad)
    return () => cancelAnimationFrame(handle)

    function clamp(num: number, min: number, max: number) {
      return Math.min(Math.max(num, min), max)
    }

    function scrollTheLad() {
      if (scrollContainerRef.current == null) return
      const { x: px, y: py } = lastClientRef.current
      const cr = scrollContainerRef.current.getBoundingClientRect()

      const shouldScrollRight = cr.right  - px < 20
      const shouldScrollLeft  = px - cr.left   < 20
      const shouldScrollDown  = cr.bottom - py < 20
      const shouldScrollUp    = py - cr.top    < 20

      const left = shouldScrollRight
        ? clamp(20 - (cr.right  - px), 0, 15)
        : shouldScrollLeft
        ? -1 * clamp(20 - (px - cr.left), 0, 15)
        : undefined

      const top = shouldScrollDown
        ? clamp(20 - (cr.bottom - py), 0, 15)
        : shouldScrollUp
        ? -1 * clamp(20 - (py - cr.top), 0, 15)
        : undefined

      if (top === undefined && left === undefined) {
        handle = requestAnimationFrame(scrollTheLad)
        return
      }

      scrollContainerRef.current.scrollBy({ left, top })
      handle = requestAnimationFrame(scrollTheLad)
    }
  }, [isDragging])

  // Selection rect in container-relative coords — null until 10 px threshold is crossed
  const selectionRect = dragVector && isDragging ? dragVector.toDOMRect() : null

  // Global border toggle — DB value (via prop) takes precedence over localStorage
  const [globalBordersEnabled, setGlobalBordersEnabled] = useState<boolean>(() => {
    if (initialBordersEnabled !== undefined) return initialBordersEnabled
    try {
      const v = localStorage.getItem('linkmine_borders_global')
      return v === null ? true : v !== 'false'
    } catch { return true }
  })

  // Sync global border toggle when changed from Settings (cross-tab)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'linkmine_borders_global') {
        setGlobalBordersEnabled(e.newValue === null ? true : e.newValue !== 'false')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Per-domain colored-border toggle — persisted to localStorage
  const [hiddenBorderDomains, setHiddenBorderDomains] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('linkmine_hidden_border_domains')
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })

  const toggleBorderColor = useCallback((domain: string) => {
    setHiddenBorderDomains(prev => {
      const next = new Set(prev)
      if (next.has(domain)) {
        next.delete(domain)
      } else {
        next.add(domain)
      }
      try {
        localStorage.setItem('linkmine_hidden_border_domains', JSON.stringify([...next]))
      } catch { /* ignore */ }
      return next
    })
  }, [])

  // Stable debounced update — optimistic: parent state is updated immediately,
  // API call is debounced and reverts on failure.
  const updateDomainGrouping = useCallback((domain: string, grouped: boolean) => {
    onDomainPreferenceChange(domain, grouped)
    if (pendingGroupingRef.current) clearTimeout(pendingGroupingRef.current)
    pendingGroupingRef.current = setTimeout(async () => {
      setLoadingPreferences(true)
      try {
        const response = await fetch('/api/bookmarks/domain-grouping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain, grouped }),
        })
        if (!response.ok) {
          onDomainPreferenceChange(domain, !grouped) // revert
        }
      } catch (error) {
        console.error('Failed to update domain grouping:', error)
        onDomainPreferenceChange(domain, !grouped) // revert
      } finally {
        setLoadingPreferences(false)
      }
    }, 300)
  }, [onDomainPreferenceChange])

  const toggleGroupExpansion = (domain: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(domain)) {
        newSet.delete(domain)
      } else {
        newSet.add(domain)
      }
      return newSet
    })
  }

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

  // Group bookmarks by domain for separated display
  const { grouped: groupedBookmarks, individual: individualBookmarks, domainCounts } = groupBookmarksByDomain(mainBookmarks, domainPreferences)
  const { grouped: groupedStaleBookmarks, individual: individualStaleBookmarks, domainCounts: staleDomainCounts } = showOldLinks ? groupBookmarksByDomain(staleBookmarks, domainPreferences) : { grouped: [], individual: [], domainCounts: {} }

  return (
    <div
      ref={containerRef}
      onPointerDown={selectionMode ? handlePointerDown : undefined}
      onPointerMove={selectionMode ? handlePointerMove : undefined}
      onPointerUp={selectionMode ? handlePointerUp : undefined}
      className={`relative${selectionMode ? ' select-none' : ''}`}
    >
      {/* Lasso selection rectangle — absolute to the grid; anchor coords never move */}
      {selectionRect && (
        <div
          aria-hidden="true"
          className="absolute z-50 pointer-events-none rounded border-2 border-brand-400 bg-brand-100/25 dark:bg-brand-900/20"
          style={{
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        />
      )}
      <section aria-label={`Bookmarks (${total} total)`}>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
          {total} {total === 1 ? 'bookmark' : 'bookmarks'}
        </p>

        {/* Grouped Bookmarks Section */}
        {groupedBookmarks.length > 0 && (
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Grouped by Domain
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {groupedBookmarks.reduce((sum, group) => sum + 1 + (group.children?.length || 0), 0)} links
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
              {groupedBookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onBulkDelete={onBulkDelete}
                  expanded={expandedGroups.has(bookmark.domain)}
                  onToggleExpansion={() => toggleGroupExpansion(bookmark.domain)}
                  onToggleGrouping={(grouped) => updateDomainGrouping(bookmark.domain, grouped)}
                  loadingPreferences={loadingPreferences}
                  canBeGrouped={false}
                  colorBorderEnabled={globalBordersEnabled && !hiddenBorderDomains.has(bookmark.domain)}
                  onToggleBorderColor={globalBordersEnabled ? () => toggleBorderColor(bookmark.domain) : undefined}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(bookmark.id)}
                  onToggleSelect={onToggleSelect}
                  onToggleGroupSelect={onToggleGroupSelect}
                  isMoving={movingBookmarkId === bookmark.id}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Individual Bookmarks Section */}
        {individualBookmarks.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Individual Links
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                {individualBookmarks.length} links
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
              {individualBookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  expanded={false}
                  onToggleExpansion={() => {}}
                  onToggleGrouping={(grouped) => updateDomainGrouping(bookmark.domain, grouped)}
                  loadingPreferences={loadingPreferences}
                  canBeGrouped={(domainCounts[bookmark.domain] || 0) > 1}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(bookmark.id)}
                  onToggleSelect={onToggleSelect}
                  isMoving={movingBookmarkId === bookmark.id}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      {(groupedStaleBookmarks.length > 0 || individualStaleBookmarks.length > 0) && (
        <section className="mt-10" aria-label="You may want to revisit these">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              You may want to revisit these
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              not opened in {STALE_DAYS}+ days
            </span>
          </div>

          {/* Stale Grouped Bookmarks */}
          {groupedStaleBookmarks.length > 0 && (
            <div className="mb-6 opacity-70">
              <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">Grouped</div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
                {groupedStaleBookmarks.map((bookmark) => (
                  <BookmarkCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onBulkDelete={onBulkDelete}
                    expanded={expandedGroups.has(bookmark.domain)}
                    onToggleExpansion={() => toggleGroupExpansion(bookmark.domain)}
                    onToggleGrouping={(grouped) => updateDomainGrouping(bookmark.domain, grouped)}
                    loadingPreferences={loadingPreferences}
                    canBeGrouped={false}
                    colorBorderEnabled={globalBordersEnabled && !hiddenBorderDomains.has(bookmark.domain)}
                    onToggleBorderColor={globalBordersEnabled ? () => toggleBorderColor(bookmark.domain) : undefined}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(bookmark.id)}
                    onToggleSelect={onToggleSelect}
                    onToggleGroupSelect={onToggleGroupSelect}
                    isMoving={movingBookmarkId === bookmark.id}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Stale Individual Bookmarks */}
          {individualStaleBookmarks.length > 0 && (
            <div className="opacity-70">
              <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">Individual</div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list">
                {individualStaleBookmarks.map((bookmark) => (
                  <BookmarkCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    expanded={false}
                    onToggleExpansion={() => {}}
                    onToggleGrouping={(grouped) => updateDomainGrouping(bookmark.domain, grouped)}
                    loadingPreferences={loadingPreferences}
                    canBeGrouped={(staleDomainCounts[bookmark.domain] || 0) > 1}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(bookmark.id)}
                    onToggleSelect={onToggleSelect}
                    isMoving={movingBookmarkId === bookmark.id}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function BookmarkCard({
  bookmark,
  onEdit,
  onDelete,
  onBulkDelete,
  expanded = false,
  onToggleExpansion,
  onToggleGrouping,
  loadingPreferences = false,
  canBeGrouped = false,
  colorBorderEnabled = true,
  onToggleBorderColor,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onToggleGroupSelect,
  isMoving = false,
}: {
  bookmark: DomainGroupedBookmark
  onEdit: (b: Bookmark) => void
  onDelete: (id: string) => void
  onBulkDelete?: (ids: string[], domain: string) => void
  expanded?: boolean
  onToggleExpansion?: () => void
  onToggleGrouping?: (grouped: boolean) => void
  loadingPreferences?: boolean
  canBeGrouped?: boolean
  colorBorderEnabled?: boolean
  onToggleBorderColor?: () => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
  onToggleGroupSelect?: (ids: string[]) => void
  isMoving?: boolean
}) {
  const domain = (() => {
    try { return new URL(bookmark.url).hostname } catch { return '' }
  })()

  const favicon = getSmartFaviconUrl(bookmark.url, domain)
  const due = isReminderDue(bookmark)
  const upcoming = isReminderUpcoming(bookmark)
  const hasChildren = bookmark.isParent && bookmark.children && bookmark.children.length > 0
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)

  // useDraggable must be called unconditionally (before any early return)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `bookmark:${bookmark.id}`,
    data: { type: 'bookmark', id: bookmark.id, folderId: bookmark.folderId },
    disabled: selectionMode || hasChildren, // grouped cards not draggable
  })
  // When using DragOverlay, do NOT apply the translate transform to the original —
  // just make it a transparent ghost placeholder so the grid layout is preserved.
  const dragStyle: React.CSSProperties | undefined = isDragging
    ? { opacity: 0, pointerEvents: 'none' }
    : undefined

  // Parent bookmark with children (grouped)
  if (hasChildren) {
    const hue = domainHue(domain)

    return (
      <li
        data-bookmark-id={bookmark.id}
        data-bookmark-children={(bookmark.children?.map((c) => c.id) ?? []).join(',')}
        className="space-y-1 relative"
      >
        {/* Parent bookmark card */}
        <div
          className={`card group flex flex-col transition hover:shadow-md dark:!bg-gray-800 ${
            due ? 'ring-1 ring-amber-400 dark:ring-amber-500' : ''
          } ${selectionMode && isSelected ? 'ring-2 ring-brand-500' : ''}`}
          style={colorBorderEnabled ? { border: `2px solid hsl(${hue} 60% 50%)` } : undefined}
        >
          {/* Header with expand/collapse control */}
          <div className="p-4 pb-2 px-2">
            {/* Top row: Domain info */}
            <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 mb-2">
              <button
                onClick={onToggleExpansion}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              {/* Parent favicon / icon */}
              {bookmark.icon && !bookmark.icon.startsWith('http') ? (
                <span className="text-base leading-none" aria-hidden="true">{bookmark.icon}</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bookmark.icon?.startsWith('http') ? bookmark.icon : favicon}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0 rounded"
                  onError={(e) => handleFaviconError(e, bookmark.url, domain)}
                />
              )}
              <span className="truncate text-sm font-semibold text-gray-700 dark:text-gray-300">
                {domain}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `hsl(${hue} 50% 92%)`,
                  color: `hsl(${hue} 20% 10%)`,
                }}
              >
                {(bookmark.children?.length || 0) + 1} links
              </span>
            </div>

            {/* Bottom row: Link tree (TreeView — manages its own expand state) */}
            <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-2">
                <TreeView
                  nodes={buildTreeFromBookmarks(bookmark)}
                  label={`Links from ${domain}`}
                />
              </div>
            </div>
          </div>

          {/* Expanded children */}
          {expanded && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
              <div className="space-y-2">
                {/* Parent bookmark as first item */}
                <NestedBookmarkItem
                  bookmark={bookmark}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isLastClicked={lastClickedId === bookmark.id}
                  onLinkClick={() => setLastClickedId(bookmark.id)}
                />

                {/* Children bookmarks */}
                {bookmark.children?.map((child) => (
                  <NestedBookmarkItem
                    key={child.id}
                    bookmark={child}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    isLastClicked={lastClickedId === child.id}
                    onLinkClick={() => setLastClickedId(child.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Footer: group actions */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleGrouping?.(false)
                }}
                disabled={loadingPreferences}
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                title="Ungroup these bookmarks"
              >
                <Ungroup className="h-3.5 w-3.5" />
                Ungroup
              </button>


              {onToggleBorderColor && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleBorderColor()
                }}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${
                colorBorderEnabled
                  ? 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40'
              }`}
              title={colorBorderEnabled ? 'Hide color border' : 'Show color border'}
              aria-label={colorBorderEnabled ? 'Hide color border for this group' : 'Show color border for this group'}
              aria-pressed={colorBorderEnabled}
              >
                <Palette className="h-3.5 w-3.5" style={colorBorderEnabled ? { color: `hsl(${hue} 60% 50%)` } : undefined} />
              </button>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation()
                const allIds = [bookmark.id, ...(bookmark.children?.map((c) => c.id) ?? [])]
                if (onBulkDelete) {
                  onBulkDelete(allIds, domain)
                } else {
                  // fallback: single delete
                  allIds.forEach((id) => onDelete(id))
                }
              }}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              title={`Delete all ${(bookmark.children?.length || 0) + 1} bookmarks from ${domain}`}
              aria-label={`Delete all bookmarks from ${domain}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete all
            </button>
            {selectionMode && (
              <label className="z-10 flex cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleGroupSelect?.([bookmark.id, ...(bookmark.children?.map((c) => c.id) ?? [])])}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  aria-label={`Select bookmark group from ${domain}`}
                />
              </label>
            )}
          </div>
        </div>
      </li>
    )
  }

  // Regular single bookmark card
  return (
    <li
      ref={setDragRef}
      data-bookmark-id={bookmark.id}
      style={dragStyle}
      {...listeners}
      {...attributes}
      className={`card group flex flex-col justify-between p-4 transition hover:shadow-md relative touch-none ${
        due ? 'ring-1 ring-amber-400 dark:ring-amber-500' : ''
      } ${selectionMode && isSelected ? 'ring-2 ring-brand-500' : ''} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${isMoving ? 'animate-bookmark-move' : ''}`}
    >
      <div className="grid grid-cols-[auto_1fr] items-start gap-3">
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
              onError={(e) => handleFaviconError(e, bookmark.url, domain)}
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
            onError={(e) => handleFaviconError(e, bookmark.url, domain)}
          />
        )}

        {/* Title & URL */}
        <div className="min-w-0 flex-1">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackAccess(bookmark.id)}
            className="grid grid-cols-[1fr_auto] gap-2 justify-between truncate text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-600"
          >
            <span className="truncate" title={bookmark.title}>
              {bookmark.title}
            </span>
            <ExternalLink className="w-4 h-4" />
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
          {(bookmark.folder || isMoving) && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              📁{' '}
              {isMoving ? (
                <span className="inline-block h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-600" aria-label="Moving to folder…" />
              ) : (
                <span className="truncate">{bookmark.folder!.name}</span>
              )}
            </span>
          )}
          {bookmark.reminderDate && (
            <span className="text-xs text-gray-400">
              🔔 {new Date(bookmark.reminderDate).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Group button for individual bookmarks with siblings */}
          {canBeGrouped && (
            <button
              onClick={() => onToggleGrouping?.(true)}
              disabled={loadingPreferences}
              aria-label={`Group bookmarks from ${domain}`}
              className="rounded p-1 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 disabled:opacity-50"
              title={`Group with other ${domain} bookmarks`}
            >
              <Group className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => onEdit(bookmark)}
            aria-label={`Edit bookmark: ${bookmark.title}`}
            className="rounded p-1 hover:bg-yellow-50 hover:text-yellow-300 dark:hover:bg-gray-700"
          >
            <SquarePen className="h-5 w-5" />
          </button>
          <button
            onClick={() => onDelete(bookmark.id)}
            aria-label={`Delete bookmark: ${bookmark.title}`}
            className="rounded p-1 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          {selectionMode && (
            <label className="ml-1 z-10 flex cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect?.(bookmark.id)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                aria-label={`Select bookmark: ${bookmark.title}`}
              />
            </label>
          )}
        </div>
      </div>
    </li>
  )
}

// Nested bookmark item component for grouped bookmarks
function NestedBookmarkItem({
  bookmark,
  onEdit,
  onDelete,
  isLastClicked = false,
  onLinkClick,
}: {
  bookmark: Bookmark
  onEdit: (b: Bookmark) => void
  onDelete: (id: string) => void
  isLastClicked?: boolean
  onLinkClick?: () => void
}) {
  const domain = (() => {
    try { return new URL(bookmark.url).hostname } catch { return '' }
  })()

  const due = isReminderDue(bookmark)
  const upcoming = isReminderUpcoming(bookmark)

  return (
    <div className={`group p-3 rounded-md border transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
      isLastClicked ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-200 dark:border-gray-600'
    }`}>
      <div className="grid grid-cols-[auto] items-start gap-3">

        <div className="min-w-0 flex-1 flex-col">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { trackAccess(bookmark.id); onLinkClick?.() }}
            className="block truncate text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-600"
          >
            {bookmark.title}
          </a>
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {bookmark.url.replace(`https://${domain}`, '').replace(`http://${domain}`, '') || '/'}
          </p>

          {/* Compact tags */}
          {bookmark.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {bookmark.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
              {bookmark.tags.length > 3 && (
                <span className="text-xs text-gray-500">+{bookmark.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {(due || upcoming) && (
            <span
              className={`shrink-0 rounded px-1 py-0.5 text-xs font-semibold ${
                due
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
              }`}
            >
              {due ? 'Due' : 'Soon'}
            </span>
          )}

          <button
            onClick={() => onEdit(bookmark)}
            className="group-hover:opacity-100 rounded p-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity"
            aria-label={`Edit bookmark: ${bookmark.title}`}
          >
            <SquarePen className="h-3 w-3" />
          </button>

          <button
            onClick={() => onDelete(bookmark.id)}
            className="group-hover:opacity-100 rounded p-2 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 transition-opacity"
            aria-label={`Delete bookmark: ${bookmark.title}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
