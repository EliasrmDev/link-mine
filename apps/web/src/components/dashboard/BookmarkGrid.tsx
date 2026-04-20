'use client'

import { useState, useRef, useCallback } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Group, Link, SquarePen, Trash2, Ungroup } from 'lucide-react'
import type { Bookmark, Folder, DomainGroupedBookmark, TreeNodeData } from '@linkmine/shared'
import TreeView from '@/components/dashboard/TreeView'

const STALE_DAYS = 30

// Deterministic hue from domain string for unique group colors
function domainHue(domain: string): number {
  let hash = 0
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash)
  }
  return ((hash % 360) + 360) % 360
}

function isLocalDomain(domain: string): boolean {
  return (
    domain === 'localhost' ||
    domain.startsWith('127.') ||
    domain.startsWith('192.168.') ||
    domain.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(domain) ||
    domain.endsWith('.local') ||
    domain.endsWith('.localhost')
  )
}

// Smart favicon URL generator that handles localhost and subdomain cases
function getSmartFaviconUrl(url: string, domain: string): string {
  if (!domain) return ''

  try {
    const urlObj = new URL(url)
    const origin = `${urlObj.protocol}//${urlObj.host}`

    // Local/private URLs: Google service can't reach them, use direct path
    if (isLocalDomain(domain)) {
      return `${origin}/favicon.ico`
    }

    // Subdomains: use direct favicon.ico — Google often lacks their favicons
    // Error handler will fall back to Google if the direct path fails
    const domainParts = domain.split('.')
    if (domainParts.length > 2) {
      return `${origin}/favicon.ico`
    }

    // Standard domain — use Google service
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
  } catch {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
  }
}

// Enhanced error handler for favicon loading
function handleFaviconError(e: React.SyntheticEvent<HTMLImageElement>, url: string, domain: string) {
  const target = e.currentTarget

  // Already on Google service — try root domain for subdomains, then give up
  if (target.src.includes('google.com/s2/favicons')) {
    const domainParts = domain.split('.')
    if (domainParts.length > 2) {
      const rootDomain = domainParts.slice(-2).join('.')
      if (!target.src.includes(encodeURIComponent(rootDomain))) {
        target.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(rootDomain)}&sz=32`
        return
      }
    }
    target.style.display = 'none'
    return
  }

  // Direct favicon.ico failed — local URLs have no Google fallback, just hide
  if (isLocalDomain(domain)) {
    target.style.display = 'none'
    return
  }

  // Public site: fall back to Google service
  target.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
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

// Build a URL-path-based tree from a grouped bookmark (parent + flat children)
function buildTreeFromBookmarks(parent: DomainGroupedBookmark): TreeNodeData[] {
  const children = parent.children ?? []

  // Root node — always expanded
  const root: TreeNodeData = {
    id: parent.id,
    title: parent.title,
    href: parent.url,
    defaultExpanded: true,
  }

  if (!children.length) return [root]

  // Track created nodes by URL so we can append grandchildren later
  const nodeByUrl = new Map<string, TreeNodeData>()
  nodeByUrl.set(parent.url, root)

  // Sort by ascending path depth so parents are created before their children
  const sorted = [...children].sort((a, b) => {
    try {
      const aD = new URL(a.url).pathname.split('/').filter(Boolean).length
      const bD = new URL(b.url).pathname.split('/').filter(Boolean).length
      return aD - bD
    } catch { return 0 }
  })

  for (const child of sorted) {
    const node: TreeNodeData = { id: child.id, title: child.title, href: child.url }

    // Find the closest ancestor whose path is a prefix of this child's path
    let bestParentNode = root
    let bestMatchLen = 0

    try {
      const childUrl = new URL(child.url)
      const childPath = childUrl.pathname

      for (const [url, treeNode] of nodeByUrl) {
        try {
          const pUrl = new URL(url)
          if (pUrl.origin !== childUrl.origin) continue
          const pPath = pUrl.pathname.endsWith('/') ? pUrl.pathname : pUrl.pathname + '/'
          if (childPath.startsWith(pPath) && pPath.length > bestMatchLen) {
            bestMatchLen = pPath.length
            bestParentNode = treeNode
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }

    if (!bestParentNode.children) bestParentNode.children = []
    bestParentNode.children.push(node)
    nodeByUrl.set(child.url, node)
  }

  return [root]
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
  showOldLinks?: boolean
}

export function BookmarkGrid({ bookmarks, total, loading, domainPreferences, onDomainPreferenceChange, onEdit, onDelete, showOldLinks }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [loadingPreferences, setLoadingPreferences] = useState(false)
  const pendingGroupingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    <div>
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
                  expanded={expandedGroups.has(bookmark.domain)}
                  onToggleExpansion={() => toggleGroupExpansion(bookmark.domain)}
                  onToggleGrouping={(grouped) => updateDomainGrouping(bookmark.domain, grouped)}
                  loadingPreferences={loadingPreferences}
                  canBeGrouped={false}
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
                    expanded={expandedGroups.has(bookmark.domain)}
                    onToggleExpansion={() => toggleGroupExpansion(bookmark.domain)}
                    onToggleGrouping={(grouped) => updateDomainGrouping(bookmark.domain, grouped)}
                    loadingPreferences={loadingPreferences}
                    canBeGrouped={false}
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
  expanded = false,
  onToggleExpansion,
  onToggleGrouping,
  loadingPreferences = false,
  canBeGrouped = false,
}: {
  bookmark: DomainGroupedBookmark
  onEdit: (b: Bookmark) => void
  onDelete: (id: string) => void
  expanded?: boolean
  onToggleExpansion?: () => void
  onToggleGrouping?: (grouped: boolean) => void
  loadingPreferences?: boolean
  canBeGrouped?: boolean
}) {
  const domain = (() => {
    try { return new URL(bookmark.url).hostname } catch { return '' }
  })()

  const favicon = getSmartFaviconUrl(bookmark.url, domain)
  const due = isReminderDue(bookmark)
  const upcoming = isReminderUpcoming(bookmark)
  const hasChildren = bookmark.isParent && bookmark.children && bookmark.children.length > 0
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)

  // Parent bookmark with children (grouped)
  if (hasChildren) {
    const hue = domainHue(domain)

    return (
      <li className="space-y-1">
        {/* Parent bookmark card */}
        <div
          className={`card group flex flex-col transition hover:shadow-md dark:!bg-gray-800 ${
            due ? 'ring-1 ring-amber-400 dark:ring-amber-500' : ''
          }`}
          style={{
            border: `2px solid hsl(${hue} 60% 50%)`,
          }}
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

            <button
              onClick={(e) => {
                e.stopPropagation()
                // Delete parent + all children
                bookmark.children?.forEach((child) => onDelete(child.id))
                onDelete(bookmark.id)
              }}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              title={`Delete all ${(bookmark.children?.length || 0) + 1} bookmarks from ${domain}`}
              aria-label={`Delete all bookmarks from ${domain}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </li>
    )
  }

  // Regular single bookmark card
  return (
    <li
      className={`card group flex flex-col justify-between p-4 transition hover:shadow-md ${
        due ? 'ring-1 ring-amber-400 dark:ring-amber-500' : ''
      }`}
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
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2">
          <Link className="w-3 h-3 text-gray-400" />
        </div>

        <div className="min-w-0 flex-1">
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

        <div className="flex items-center gap-1">
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
            className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity"
            aria-label={`Edit bookmark: ${bookmark.title}`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          <button
            onClick={() => onDelete(bookmark.id)}
            className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 transition-opacity"
            aria-label={`Delete bookmark: ${bookmark.title}`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
