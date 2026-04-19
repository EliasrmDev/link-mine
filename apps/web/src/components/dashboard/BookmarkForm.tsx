'use client'

import { useState, useEffect, useRef, useMemo, useId } from 'react'
import type { Bookmark, Folder } from '@linkmine/shared'
import { PRESET_ICONS } from '@linkmine/shared'
import { PRESET_TAGS } from '@linkmine/shared'
import { Modal } from '../ui/Modal'

function normalizeTagsCaseInsensitive(tags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of tags) {
    const normalized = raw.trim().toLowerCase()
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

// Helper to get favicon URL for a domain using Google service to avoid CORS issues
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
  } catch {
    return ''
  }
}

// Helper to extract page title from HTML
function extractTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (!match) return ''

  // Decode HTML entities
  const title = match[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()

  return title
}


interface Props {
  bookmark?: Bookmark
  folders: Folder[]
  defaultFolderId: string | null
  initialDraft?: {
    url: string
    title: string
    tags: string[]
    icon: string
    reminderDate: string
    folderId: string
  }
  onOpenCreateFolder?: (draft: {
    url: string
    title: string
    tags: string[]
    icon: string
    reminderDate: string
    folderId: string
  }) => void
  onEditExisting?: (bookmark: Bookmark) => void
  onSave: () => void
  onClose: () => void
}

export function BookmarkForm({
  bookmark,
  folders,
  defaultFolderId,
  initialDraft,
  onOpenCreateFolder,
  onEditExisting,
  onSave,
  onClose,
}: Props) {
  const isEditing = !!bookmark
  const formId = useId()
  const [url, setUrl] = useState(bookmark?.url ?? initialDraft?.url ?? '')
  const [title, setTitle] = useState(bookmark?.title ?? initialDraft?.title ?? '')
  const [tagInput, setTagInput] = useState(bookmark?.tags.join(', ') ?? initialDraft?.tags.join(', ') ?? '')
  const [icon, setIcon] = useState(bookmark?.icon ?? initialDraft?.icon ?? '')
  const [currentFavicon, setCurrentFavicon] = useState<string>(bookmark?.icon?.startsWith('http') ? bookmark.icon : '')
  const [customIcon, setCustomIcon] = useState<string>(
    (bookmark?.icon && !bookmark.icon.startsWith('http')) ? bookmark.icon : (initialDraft?.icon && !initialDraft.icon.startsWith('http')) ? initialDraft.icon : ''
  )
  const [reminderDate, setReminderDate] = useState(
    bookmark?.reminderDate ? bookmark.reminderDate.slice(0, 10) : (initialDraft?.reminderDate ?? ''),
  )
  const [folderInput, setFolderInput] = useState<string>(() => {
    const currentFolderId = bookmark?.folderId ?? initialDraft?.folderId ?? defaultFolderId ?? ''
    if (!currentFolderId) return ''

    // Find folder name from ID
    const folder = folders.find(f => f.id === currentFolderId)
    if (folder) return folder.name

    // Check subfolder
    for (const f of folders) {
      const child = f.children?.find(c => c.id === currentFolderId)
      if (child) return `${f.name}/${child.name}`
    }

    return ''
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [syncedTags, setSyncedTags] = useState<string[]>([])
  const [syncedIcons, setSyncedIcons] = useState<string[]>([])
  const [suggestedFavicon, setSuggestedFavicon] = useState<string>('')
  const [cachedFavicon, setCachedFavicon] = useState<string>(
    bookmark?.icon?.startsWith('http') ? bookmark.icon : (initialDraft?.icon?.startsWith('http') ? initialDraft.icon : '')
  )
  const [folderUsageStats, setFolderUsageStats] = useState<Record<string, number>>({})
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Fetch favicon (and optionally title) for a given URL
  const fetchPageMetadata = async (targetUrl: string, opts: { updateTitle: boolean }) => {
    setSuggestedFavicon('')

    try {
      new URL(targetUrl)
    } catch {
      return
    }

    const hasCustomIcon = currentFavicon.trim() !== '' || customIcon.trim() !== ''
    // When editing, don't re-suggest if already using a favicon
    if (isEditing && currentFavicon.trim() !== '') return

    setLoadingMetadata(true)
    try {
      const proxyUrl = `/api/page-metadata?url=${encodeURIComponent(targetUrl)}`
      const response = await fetch(proxyUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) {
        const data = await response.json()

        if (opts.updateTitle && data.title) {
          setTitle(data.title)
        }

        if (!hasCustomIcon) {
          const faviconUrl = data.favicon || getFaviconUrl(targetUrl)
          setSuggestedFavicon(faviconUrl)
          setCachedFavicon(faviconUrl)
        }
      } else {
        if (opts.updateTitle) {
          const domain = new URL(targetUrl).origin.replace('www.', '')
          const fallbackTitle = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
          setTitle(fallbackTitle)
        }
        if (!hasCustomIcon) {
          const faviconUrl = getFaviconUrl(targetUrl)
          setSuggestedFavicon(faviconUrl)
          setCachedFavicon(faviconUrl)
        }
      }
    } catch (error) {
      console.warn('Failed to fetch page metadata:', error)
      if (!hasCustomIcon) {
        const faviconUrl = getFaviconUrl(targetUrl)
        setSuggestedFavicon(faviconUrl)
        setCachedFavicon(faviconUrl)
      }
    } finally {
      setLoadingMetadata(false)
    }
  }

  // Auto-complete title and favicon when URL changes
  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl)

    const hasCustomTitle = title.trim() !== ''
    const hasCustomIcon = currentFavicon.trim() !== '' || customIcon.trim() !== ''

    // For new bookmarks: skip if user already has both title and icon
    if (!isEditing && hasCustomTitle && hasCustomIcon) return

    await fetchPageMetadata(newUrl, { updateTitle: !isEditing && !hasCustomTitle })
  }

  useEffect(() => {
    firstInputRef.current?.focus()

    const loadPresets = async () => {
      const [presetsRes, statsRes] = await Promise.all([
        fetch('/api/presets'),
        fetch('/api/folders/usage-stats').catch(() => null)
      ])

      if (presetsRes.ok) {
        const data = await presetsRes.json().catch(() => ({ tags: [], icons: [] }))
        const tags = Array.isArray(data.tags) ? data.tags.map((t: unknown) => String(t)) : []
        const icons = Array.isArray(data.icons) ? data.icons.map((i: unknown) => String(i).trim()) : []
        setSyncedTags(normalizeTagsCaseInsensitive(tags))
        setSyncedIcons(Array.from(new Set(icons.filter(Boolean))))
      }

      if (statsRes && statsRes.ok) {
        const statsData = await statsRes.json().catch(() => ({}))
        setFolderUsageStats(statsData.folderUsage || {})
      }
    }

    void loadPresets()

    // When editing, fetch favicon if none is currently set
    const initialUrl = bookmark?.url ?? initialDraft?.url ?? ''
    const hasInitialFavicon = !!(bookmark?.icon?.startsWith('http') || initialDraft?.icon?.startsWith('http'))
    if (isEditing && initialUrl && !hasInitialFavicon) {
      void fetchPageMetadata(initialUrl, { updateTitle: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to find or create folder based on input text
  async function resolveFolderId(folderInput: string): Promise<string> {
    const trimmed = folderInput.trim()
    if (!trimmed) return ''

    // Check if it's a path (contains /)
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/').map(s => s.trim()).filter(Boolean)
      if (parts.length !== 2) {
        // For now, only support parent/child structure
        throw new Error('Only one level of subfolders is supported (e.g., "Work/Projects")')
      }

      const [parentName, childName] = parts

      // Find or create parent folder
      let parent = folders.find(f => f.name.toLowerCase() === parentName.toLowerCase())
      if (!parent) {
        // Create parent folder first
        try {
          const res = await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: parentName, parentId: null })
          })
          if (res.ok) {
            const newParent = await res.json()
            parent = {
              id: newParent.id,
              name: parentName,
              parentId: null,
              children: [],
              createdAt: newParent.createdAt || new Date().toISOString(),
              updatedAt: newParent.updatedAt || new Date().toISOString()
            }
          } else {
            throw new Error(`Failed to create parent folder: ${parentName}`)
          }
        } catch (error) {
          console.error('Failed to create parent folder:', error)
          throw error
        }
      }

      // Check if child exists
      const child = parent.children?.find(c => c.name.toLowerCase() === childName.toLowerCase())
      if (child) return child.id

      // Create child folder
      try {
        const res = await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: childName, parentId: parent.id })
        })
        if (res.ok) {
          const newFolder = await res.json()
          return newFolder.id
        } else {
          throw new Error(`Failed to create subfolder: ${childName}`)
        }
      } catch (error) {
        console.error('Failed to create subfolder:', error)
        throw error
      }
    }

    // Simple folder name - check if exists
    const existing = folders.find(f => f.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing.id

    // Create new root folder
    return await createRootFolder(trimmed)
  }

  async function createRootFolder(name: string): Promise<string> {
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: null })
      })
      if (res.ok) {
        const newFolder = await res.json()
        return newFolder.id
      }
    } catch (error) {
      console.warn('Failed to create folder:', error)
    }
    return ''
  }

  // Get top 5 most used folders for suggestions, sorted by usage
  const topFolderSuggestions = useMemo(() => {
    const allFolderPaths = folders.flatMap((f) => [
      { path: f.name, id: f.id, usage: folderUsageStats[f.id] || 0 },
      ...(f.children ?? []).map((c) => ({
        path: `${f.name}/${c.name}`,
        id: c.id,
        usage: folderUsageStats[c.id] || 0
      }))
    ])

    return allFolderPaths
      .sort((a, b) => b.usage - a.usage) // Sort by most used first
      .slice(0, 5) // Top 5
      .map(item => item.path)
  }, [folders, folderUsageStats])

  // Filter suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    if (!folderInput.trim()) return topFolderSuggestions

    return topFolderSuggestions.filter((suggestion) =>
      suggestion.toLowerCase().includes(folderInput.toLowerCase().trim())
    )
  }, [folderInput, topFolderSuggestions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const normalizedTags = normalizeTagsCaseInsensitive(tags)

    setSaving(true)
    try {
      // Resolve folder ID from input text
      const resolvedFolderId = await resolveFolderId(folderInput)

      const finalIcon = currentFavicon || customIcon || null

      const body = {
        url,
        title,
        tags: normalizedTags,
        icon: finalIcon,
        reminderDate: reminderDate ? new Date(reminderDate).toISOString() : null,
        folderId: resolvedFolderId || null,
      }

      const res = await fetch(
        isEditing ? `/api/bookmarks/${bookmark.id}` : '/api/bookmarks',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409 && data.existingBookmark && onEditExisting) {
          // Handle duplicate bookmark - ask if user wants to edit existing one
          const shouldEdit = confirm(
            `This URL has already been bookmarked.\n\nTitle: "${data.existingBookmark.title}"\nCreated: ${new Date(data.existingBookmark.createdAt).toLocaleDateString()}\n\nWould you like to edit the existing bookmark instead?`
          )

          if (shouldEdit) {
            onClose() // Close current modal
            onEditExisting(data.existingBookmark) // Open edit modal for existing bookmark
            return
          } else {
            setError('Bookmark not saved - URL already exists')
            return
          }
        } else {
          setError(data.error ?? 'Something went wrong')
          return
        }
      }

      const data = await res.json().catch(() => null)
      const nextIcon = data?.icon ? String(data.icon).trim() : ''

      setSyncedTags((prev) => normalizeTagsCaseInsensitive([...prev, ...normalizedTags]))
      if (nextIcon) {
        if (nextIcon.startsWith('http')) {
          setCurrentFavicon(nextIcon)
          setCustomIcon('')
        } else {
          setCustomIcon(nextIcon)
          setCurrentFavicon('')
        }
        setSyncedIcons((prev) => Array.from(new Set([...prev, nextIcon])))
      }

      onSave()
    } finally {
      setSaving(false)
    }
  }

  const selectedTags = normalizeTagsCaseInsensitive(
    tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  )

  const allPresetTags = normalizeTagsCaseInsensitive([...PRESET_TAGS, ...syncedTags])
  const allPresetIcons = Array.from(new Set([...PRESET_ICONS, ...syncedIcons]))

  function togglePresetTag(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag]
    setTagInput(next.join(', '))
  }

  function handleUseFavicon() {
    const favicon = suggestedFavicon || cachedFavicon
    if (favicon) {
      setCurrentFavicon(favicon)
      setCachedFavicon(favicon)
      setCustomIcon('')
      setSuggestedFavicon('')
    }
  }

  function handleClearFavicon() {
    setCurrentFavicon('')
  }

  return (
    <Modal
      title={isEditing ? 'Edit bookmark' : 'Add bookmark'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4 sm:space-y-4">
          <div>
            <label htmlFor={`${formId}-url`} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              URL <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={firstInputRef}
                id={`${formId}-url`}
                type="url"
                required
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com"
                className="input pr-10"
                aria-required="true"
              />
              {loadingMetadata && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-brand-600 rounded-full"></div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor={`${formId}-title`} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id={`${formId}-title`}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={loadingMetadata ? "Fetching page title..." : "Page title"}
              className="input"
              aria-required="true"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Icon</label>

            {/* Current Favicon Section */}
            {currentFavicon && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Favicon</span>
                  <button
                    type="button"
                    onClick={handleClearFavicon}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={currentFavicon}
                    alt="Current favicon"
                    width="24"
                    height="24"
                    className="rounded shrink-0"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      try {
                        const domain = new URL(currentFavicon).origin
                        // Try Google favicon service as fallback
                        if (!target.src.includes('google.com/s2/favicons')) {
                          target.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
                        } else {
                          target.style.display = 'none'
                        }
                      } catch {
                        target.style.display = 'none'
                      }
                    }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {(() => { try { return new URL(currentFavicon).origin } catch { return currentFavicon } })()}
                  </span>
                </div>
              </div>
            )}

            {/* Suggested/Available Favicon */}
            {(suggestedFavicon || cachedFavicon) && !currentFavicon && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <img
                    src={suggestedFavicon || cachedFavicon}
                    alt="Page favicon"
                    width="24"
                    height="24"
                    className="rounded shrink-0"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      try {
                        const domain = new URL(url).origin
                        // Try Google favicon service as fallback
                        if (!target.src.includes('google.com/s2/favicons')) {
                          target.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
                        } else {
                          target.style.display = 'none'
                        }
                      } catch {
                        target.style.display = 'none'
                      }
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Use page favicon?</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 truncate mt-0.5">
                      {(() => {
                        try {
                          return new URL(suggestedFavicon || cachedFavicon).origin
                        } catch {
                          return ''
                        }
                      })()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      onClick={handleUseFavicon}
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      onClick={() => {
                        setSuggestedFavicon('')
                        setCachedFavicon('')
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Icons Section */}
            <div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">Custom Icon</span>
              <div className="grid grid-cols-8 sm:flex sm:flex-wrap items-center gap-2 sm:gap-1 mb-3">
                {allPresetIcons.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setCustomIcon(customIcon === emoji ? '' : emoji)
                      setCurrentFavicon('')
                    }}
                    className={`rounded p-2 sm:p-1 text-lg sm:text-base leading-none transition-colors min-h-[44px] sm:min-h-0 flex items-center justify-center ${
                      customIcon === emoji
                        ? 'bg-brand-100 ring-1 ring-brand-500 dark:bg-brand-900/40'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    aria-label={`Icon ${emoji}`}
                    aria-pressed={customIcon === emoji}
                  >
                    {emoji}
                  </button>
                ))}
                <input
                  id="bm-custom-icon"
                  type="text"
                  value={customIcon}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const newValue = e.target.value
                    // Only accept emoji/text (no URLs in this field)
                    if (!newValue.startsWith('http')) {
                      setCustomIcon(newValue.slice(0, 10))
                      if (newValue) setCurrentFavicon('')
                    }
                  }}
                  placeholder="Emoji"
                  className="input col-span-3 sm:w-24 py-2 sm:py-1 text-center"
                  aria-label="Custom emoji icon"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor={`${formId}-tags`} className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tags
            </label>
            <div className="mb-3 flex flex-wrap gap-2 sm:gap-1">
              {allPresetTags.map((tag) => {
                const active = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => togglePresetTag(tag)}
                    className={`rounded-full px-3 py-2 sm:px-2 sm:py-0.5 text-sm sm:text-xs font-medium transition-colors min-h-[44px] sm:min-h-0 flex items-center ${
                      active
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                    aria-pressed={active}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
            <input
              id={`${formId}-tags`}
              type="text"
              value={tagInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagInput(e.target.value)}
              placeholder="design, tools, reading (comma-separated)"
              className="input"
            />
          </div>

          {/* Reminder date */}
          <div>
            <label htmlFor={`${formId}-reminder`} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reminder date
            </label>
            <input
              id={`${formId}-reminder`}
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              min={(() => {
                const today = new Date()
                const year = today.getFullYear()
                const month = String(today.getMonth() + 1).padStart(2, '0')
                const day = String(today.getDate()).padStart(2, '0')
                return `${year}-${month}-${day}`
              })()}
              className="input"
            />
            {reminderDate && (
              <button
                type="button"
                onClick={() => setReminderDate('')}
                className="mt-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Clear reminder
              </button>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-folder`} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Folder
            </label>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Type folder name to create or select existing. Use "/" for subfolders (e.g., "Work/Projects")
            </p>
            <div className="relative">
              <input
                id={`${formId}-folder`}
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                placeholder="Search folders or create new"
                className="input"
                autoComplete="off"
                list="folder-datalist"
                aria-describedby="folder-help"
              />

              <datalist id="folder-datalist">
                {filteredSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>
            <div id="folder-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {filteredSuggestions.length > 0 && (
                <span>Suggestions show most frequently used folders</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary order-2 sm:order-1">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary order-1 sm:order-2">
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add bookmark'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
