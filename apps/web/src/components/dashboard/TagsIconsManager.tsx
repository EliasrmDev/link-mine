'use client'

import { useState, useEffect, useMemo } from 'react'
import { ArrowDown, ArrowUp, LayoutGrid, List, Plus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { validateIcon } from '@/lib/icon-validation'

interface Tag {
  name: string
  count: number
}

interface IconData {
  icon: string
  count: number
}

interface Props {
  allTags: string[]
  iconsInUse: string[]
  initialTags: Tag[]  // Server-side initial data
  initialIcons: IconData[]  // Server-side initial data
  onTagRenamed: (oldName: string, newName: string) => Promise<void>
  onTagDeleted: (tagName: string) => Promise<void>
  onIconUpdated: (oldIcon: string, newIcon: string) => Promise<void>
  onIconDeleted: (icon: string) => Promise<void>
  onTagCreated: (tagName: string) => Promise<void>
  onIconCreated: (icon: string) => Promise<void>
}

export function TagsIconsManager({
  iconsInUse,
  initialTags,
  initialIcons,
  onTagRenamed,
  onTagDeleted,
  onIconUpdated,
  onIconDeleted,
  onTagCreated,
  onIconCreated
}: Props) {
  // Initialize with server-side data
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [icons, setIcons] = useState<IconData[]>(initialIcons)
  const [activeTab, setActiveTab] = useState<'tags' | 'icons'>('tags')
  const [editingTag, setEditingTag] = useState<{ old: string; new: string } | null>(null)
  const [editingIcon, setEditingIcon] = useState<{ old: string; new: string } | null>(null)
  const [editingIconError, setEditingIconError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'tag' | 'icon'; name: string } | null>(null)
  const [creatingTag, setCreatingTag] = useState<string>('')
  const [creatingIcon, setCreatingIcon] = useState<string>('')
  const [creatingIconError, setCreatingIconError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState<{ type: 'tag' | 'icon' } | null>(null)
  const [loading, setLoading] = useState(false)

  // Sort & view states
  const [tagsSortBy, setTagsSortBy] = useState<'name' | 'count'>('count')
  const [tagsSortDir, setTagsSortDir] = useState<'asc' | 'desc'>('desc')
  const [tagsView, setTagsView] = useState<'list' | 'grid'>('list')
  const [iconsSortBy, setIconsSortBy] = useState<'icon' | 'count'>('count')
  const [iconsSortDir, setIconsSortDir] = useState<'asc' | 'desc'>('desc')
  const [iconsView, setIconsView] = useState<'list' | 'grid'>('list')
  const sortedTags = useMemo(() => {
    return [...tags].sort((a, b) => {
      const dir = tagsSortDir === 'asc' ? 1 : -1
      if (tagsSortBy === 'name') return a.name.localeCompare(b.name) * dir
      return (a.count - b.count) * dir
    })
  }, [tags, tagsSortBy, tagsSortDir])

  const sortedIcons = useMemo(() => {
    return [...icons].sort((a, b) => {
      const dir = iconsSortDir === 'asc' ? 1 : -1
      if (iconsSortBy === 'icon') return a.icon.localeCompare(b.icon) * dir
      return (a.count - b.count) * dir
    })
  }, [icons, iconsSortBy, iconsSortDir])

  // Update state when props change
  useEffect(() => {
    setTags(initialTags)
    setIcons(initialIcons)
  }, [initialTags, initialIcons])

  // Client-side refresh after operations
  const refreshData = async () => {
    try {
      const [presetsRes, countsRes] = await Promise.all([
        fetch('/api/presets'),
        fetch('/api/tags?counts=true'),
      ])

      const presets = presetsRes.ok ? await presetsRes.json() : { tags: [], icons: [] }
      const usageCounts: { name: string; count: number }[] = countsRes.ok ? await countsRes.json() : []

      // Update tags
      const countMap = new Map<string, number>(usageCounts.map((t) => [t.name, t.count]))
      const tagList: Tag[] = (presets.tags as string[]).map((name) => ({
        name,
        count: countMap.get(name) ?? 0,
      }))
      tagList.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      setTags(tagList)

      // Update icons
      const iconCountMap = new Map<string, number>()
      iconsInUse.forEach((icon) => {
        if (icon) iconCountMap.set(icon, (iconCountMap.get(icon) ?? 0) + 1)
      })
      const iconList: IconData[] = (presets.icons as string[]).map((icon) => ({
        icon,
        count: iconCountMap.get(icon) ?? 0,
      }))
      iconList.sort((a, b) => b.count - a.count || a.icon.localeCompare(b.icon))
      setIcons(iconList)
    } catch (error) {
      console.error('Error refreshing data:', error)
    }
  }

  const handleRenameTag = async () => {
    if (!editingTag || !editingTag.new.trim()) return

    setLoading(true)
    try {
      await onTagRenamed(editingTag.old, editingTag.new.trim())
      await refreshData()
      setEditingTag(null)
    } catch (error) {
      console.error('Error renaming tag:', error)
    }
    setLoading(false)
  }

  const handleDeleteTag = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'tag') return

    setLoading(true)
    try {
      await onTagDeleted(deleteConfirm.name)
      await refreshData()
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting tag:', error)
    }
    setLoading(false)
  }

  const handleUpdateIcon = async () => {
    if (!editingIcon || !editingIcon.new.trim()) return

    const validation = validateIcon(editingIcon.new)
    if (!validation.valid) {
      setEditingIconError(validation.error ?? 'Invalid icon')
      return
    }
    setEditingIconError('')

    setLoading(true)
    try {
      await onIconUpdated(editingIcon.old, editingIcon.new.trim())
      await refreshData()
      setEditingIcon(null)
    } catch (error) {
      console.error('Error updating icon:', error)
    }
    setLoading(false)
  }

  const handleCreateTag = async () => {
    if (!creatingTag.trim()) return

    setLoading(true)
    try {
      await onTagCreated(creatingTag.trim())
      await refreshData()
      setCreatingTag('')
      setShowCreateModal(null)
    } catch (error) {
      console.error('Error creating tag:', error)
    }
    setLoading(false)
  }

  const handleCreateIcon = async () => {
    if (!creatingIcon.trim()) return

    const validation = validateIcon(creatingIcon)
    if (!validation.valid) {
      setCreatingIconError(validation.error ?? 'Invalid icon')
      return
    }
    setCreatingIconError('')

    setLoading(true)
    try {
      await onIconCreated(creatingIcon.trim())
      await refreshData()
      setCreatingIcon('')
      setShowCreateModal(null)
    } catch (error) {
      console.error('Error creating icon:', error)
    }
    setLoading(false)
  }

  const handleDeleteIcon = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'icon') return

    setLoading(true)
    try {
      await onIconDeleted(deleteConfirm.name)
      await refreshData()
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting icon:', error)
    }
    setLoading(false)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-8 justify-center sm:justify-start px-4 sm:px-6">
          <button
            onClick={() => setActiveTab('tags')}
            className={`py-2 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'tags'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Tags ({tags.length})
          </button>
          <button
            onClick={() => setActiveTab('icons')}
            className={`py-2 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'icons'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Icons ({icons.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === 'tags' ? (
          <div className="space-y-4">
            {/* Tags toolbar: sort + view + add */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* Sort by */}
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                <button
                  onClick={() => setTagsSortBy('name')}
                  className={`px-2.5 py-1.5 transition-colors ${tagsSortBy === 'name' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  Name
                </button>
                <button
                  onClick={() => setTagsSortBy('count')}
                  className={`px-2.5 py-1.5 transition-colors border-l border-gray-200 dark:border-gray-700 ${tagsSortBy === 'count' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  Usage
                </button>
              </div>
              {/* Sort direction */}
              <button
                onClick={() => setTagsSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={tagsSortDir === 'asc' ? 'Ascending' : 'Descending'}
                aria-label={`Sort ${tagsSortDir === 'asc' ? 'ascending' : 'descending'}, click to toggle`}
              >
                {tagsSortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                <button
                  onClick={() => setTagsView('list')}
                  className={`p-1.5 transition-colors ${tagsView === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  aria-label="List view"
                  aria-pressed={tagsView === 'list'}
                >
                  <List className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setTagsView('grid')}
                  className={`p-1.5 transition-colors border-l border-gray-200 dark:border-gray-700 ${tagsView === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  aria-label="Grid view"
                  aria-pressed={tagsView === 'grid'}
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setShowCreateModal({ type: 'tag' })}
                className="btn-primary text-sm whitespace-nowrap"
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                Add Tag
              </button>
            </div>

            {tags.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  No tag presets found. Create your first tag preset to get started.
                </p>
                <button onClick={() => setShowCreateModal({ type: 'tag' })} className="btn-primary" disabled={loading}>
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  Create Your First Tag
                </button>
              </div>
            ) : tagsView === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {sortedTags.map((tag) => (
                  <div
                    key={tag.name} // flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 gap-3 sm:gap-0
                    className="flex flex-col gap-2 p-3 border border-gray-600 dark:border-gray-400 rounded-lg hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                  >
                    <span className="truncate inline-flex items-center px-2 py-0.5 text-xs font-medium border border-brand-500 text-brand-800 dark:border-brand-900/30 dark:text-brand-300">
                      {tag.name}
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-gray-500 tabular-nums">
                        {tag.count > 0 ? `${tag.count} bk.` : '—'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingTag({ old: tag.name, new: tag.name })}
                          className="text-[10px] text-blue-600 rounded border border-blue-600 py-0.5 px-1 dark:text-blue-400 dark:border-blue-400 hover:underline"
                          disabled={loading}
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'tag', name: tag.name })}
                          className="text-[10px] text-red-600 rounded border border-red-600 py-0.5 px-1 dark:text-red-400 dark:border-red-400 hover:underline"
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3">
                {sortedTags.map((tag) => (
                  <div
                    key={tag.name}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-gray-400 dark:border-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 gap-3 sm:gap-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
                        {tag.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {tag.count > 0 ? `${tag.count} bookmark${tag.count !== 1 ? 's' : ''}` : 'Not used yet'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => setEditingTag({ old: tag.name, new: tag.name })}
                        className="btn-ghost px-2 py-1 border border-blue-600 text-xs md:bg-transparent md:hover:bg-gray-100 md:dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400"
                        disabled={loading}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'tag', name: tag.name })}
                        className="btn-ghost px-2 py-1 border border-red-600 text-xs md:bg-transparent md:hover:bg-gray-100 md:dark:hover:bg-gray-800 text-red-600 dark:text-red-400"
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'icons' ? (
          <div className="space-y-4">
            {/* Icons toolbar: sort + view + add */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* Sort by */}
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                <button
                  onClick={() => setIconsSortBy('icon')}
                  className={`px-2.5 py-1.5 transition-colors ${iconsSortBy === 'icon' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  Name
                </button>
                <button
                  onClick={() => setIconsSortBy('count')}
                  className={`px-2.5 py-1.5 transition-colors border-l border-gray-200 dark:border-gray-700 ${iconsSortBy === 'count' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  Usage
                </button>
              </div>
              {/* Sort direction */}
              <button
                onClick={() => setIconsSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={iconsSortDir === 'asc' ? 'Ascending' : 'Descending'}
                aria-label={`Sort ${iconsSortDir === 'asc' ? 'ascending' : 'descending'}, click to toggle`}
              >
                {iconsSortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                <button
                  onClick={() => setIconsView('list')}
                  className={`p-1.5 transition-colors ${iconsView === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  aria-label="List view"
                  aria-pressed={iconsView === 'list'}
                >
                  <List className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setIconsView('grid')}
                  className={`p-1.5 transition-colors border-l border-gray-200 dark:border-gray-700 ${iconsView === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  aria-label="Grid view"
                  aria-pressed={iconsView === 'grid'}
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setShowCreateModal({ type: 'icon' })}
                className="btn-primary text-sm whitespace-nowrap"
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                Add Icon
              </button>
            </div>

            {icons.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  No icon presets found. Create your first icon preset to get started.
                </p>
                <button onClick={() => setShowCreateModal({ type: 'icon' })} className="btn-primary" disabled={loading}>
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  Create Your First Icon Preset
                </button>
              </div>
            ) : iconsView === 'grid' ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {sortedIcons.map((iconData) => (
                  <div
                    key={iconData.icon}
                    className="flex flex-col items-center gap-2 p-3 border border-gray-200 dark:border-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                  >
                    {iconData.icon.startsWith('http') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconData.icon} alt="" width={32} height={32} className="rounded" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    ) : (
                      <span className="text-3xl leading-none">{iconData.icon}</span>
                    )}
                    <span className="text-xs text-gray-500 tabular-nums text-center">
                      {iconData.count > 0 ? `${iconData.count} bk.` : '—'}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingIcon({ old: iconData.icon, new: iconData.icon })}
                        className="text-[10px] py-0.5 px-1 border rounded border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:underline"
                        disabled={loading}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'icon', name: iconData.icon })}
                        className="text-[10px] py-0.5 px-1 border rounded border-red-600 dark:border-red-400 text-red-600 dark:text-red-400 hover:underline"
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3">
                {sortedIcons.map((iconData) => (
                  <div
                    key={iconData.icon}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-gray-200 dark:border-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 gap-3 sm:gap-0"
                  >
                    <div className="flex items-center gap-3">
                      {iconData.icon.startsWith('http') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={iconData.icon}
                          alt=""
                          width={32}
                          height={32}
                          className="rounded"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : (
                        <span className="text-2xl">{iconData.icon}</span>
                      )}
                      <span className="text-2xl hidden">🔖</span>
                      <div className="text-sm">
                        <div className="text-gray-500">
                          {iconData.count > 0 ? `${iconData.count} bookmark${iconData.count !== 1 ? 's' : ''}` : 'Not used yet'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => setEditingIcon({ old: iconData.icon, new: iconData.icon })}
                        className="btn-ghost px-2 py-1 border border-blue-600 text-xs md:bg-transparent md:hover:bg-gray-100 md:dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400"
                        disabled={loading}
                      >
                        Update
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'icon', name: iconData.icon })}
                        className="btn-ghost px-2 py-1 border border-red-600 text-xs md:bg-transparent md:hover:bg-gray-100 md:dark:hover:bg-gray-800 text-red-600 dark:text-red-400"
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Edit Tag Modal */}
      {editingTag && (
        <Modal onClose={() => setEditingTag(null)} title="Rename Tag">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tag name
              </label>
              <input
                type="text"
                value={editingTag.new}
                onChange={(e) => setEditingTag({ ...editingTag, new: e.target.value })}
                className="input w-full"
                placeholder="Enter new tag name"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditingTag(null)}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleRenameTag}
                className="btn-primary"
                disabled={loading || !editingTag.new.trim()}
              >
                {loading ? 'Renaming...' : 'Rename Tag'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Icon Modal */}
      {editingIcon && (
        <Modal onClose={() => { setEditingIcon(null); setEditingIconError('') }} title="Update Icon">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Icon
              </label>
              <input
                type="text"
                value={editingIcon.new}
                onChange={(e) => { setEditingIcon({ ...editingIcon, new: e.target.value }); setEditingIconError('') }}
                className="input w-full"
                placeholder="😀 or 🔖 or https://example.com/icon.png"
                autoFocus
                maxLength={2048}
              />
              {editingIconError ? (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1">{editingIconError}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Accepts emoji, a short symbol (≤ 10 chars), or an image URL (https://…)
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setEditingIcon(null); setEditingIconError('') }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateIcon}
                className="btn-primary"
                disabled={loading || !editingIcon.new.trim()}
              >
                {loading ? 'Updating...' : 'Update Icon'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)} title={`Delete ${deleteConfirm.type}`}>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete the {deleteConfirm.type} &ldquo;{deleteConfirm.name}&rdquo;?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={deleteConfirm.type === 'tag' ? handleDeleteTag : handleDeleteIcon}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Tag Modal */}
      {showCreateModal?.type === 'tag' && (
        <Modal onClose={() => {
          setShowCreateModal(null)
          setCreatingTag('')
        }} title="Create New Tag">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tag name
              </label>
              <input
                type="text"
                value={creatingTag}
                onChange={(e) => setCreatingTag(e.target.value)}
                className="input w-full"
                placeholder="Enter tag name"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Adding a tag here will make it available as a preset for quick selection when creating bookmarks.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(null)
                  setCreatingTag('')
                }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                className="btn-primary"
                disabled={loading || !creatingTag.trim()}
              >
                {loading ? 'Creating...' : 'Create Tag'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Icon Modal */}
      {showCreateModal?.type === 'icon' && (
        <Modal onClose={() => {
          setShowCreateModal(null)
          setCreatingIcon('')
          setCreatingIconError('')
        }} title="Create New Icon Preset">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Icon
              </label>
              <input
                type="text"
                value={creatingIcon}
                onChange={(e) => { setCreatingIcon(e.target.value); setCreatingIconError('') }}
                className="input w-full"
                placeholder="😀 or 🔖 or https://example.com/icon.png"
                autoFocus
                maxLength={2048}
              />
              {creatingIconError ? (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1">{creatingIconError}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Accepts emoji, a short symbol (≤ 10 chars), or an image URL (https://…).
                  Available as a preset when creating bookmarks.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(null)
                  setCreatingIcon('')
                  setCreatingIconError('')
                }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateIcon}
                className="btn-primary"
                disabled={loading || !creatingIcon.trim()}
              >
                {loading ? 'Creating...' : 'Create Icon'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}