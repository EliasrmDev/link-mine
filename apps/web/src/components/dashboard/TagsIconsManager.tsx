'use client'

import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'

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
  allTags,
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'tag' | 'icon'; name: string } | null>(null)
  const [creatingTag, setCreatingTag] = useState<string>('')
  const [creatingIcon, setCreatingIcon] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState<{ type: 'tag' | 'icon' } | null>(null)
  const [loading, setLoading] = useState(false)

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
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex space-x-8">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Manage all your bookmark tags. Create presets for quick access when adding bookmarks.
              </div>
              <button
                onClick={() => setShowCreateModal({ type: 'tag' })}
                className="btn-primary text-sm whitespace-nowrap"
                disabled={loading}
              >
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Tag
              </button>
            </div>

            {tags.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  No tag presets found. Create your first tag preset to get started.
                </p>
                <button
                  onClick={() => setShowCreateModal({ type: 'tag' })}
                  className="btn-primary"
                  disabled={loading}
                >
                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Your First Tag
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {tags.map((tag) => (
                  <div
                    key={tag.name}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 gap-3 sm:gap-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
                        {tag.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {tag.count > 0
                          ? `${tag.count} bookmark${tag.count !== 1 ? 's' : ''}`
                          : 'Not used yet'
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => setEditingTag({ old: tag.name, new: tag.name })}
                        className="btn-ghost px-2 py-1 text-xs md:text-xs md:bg-transparent md:hover:bg-gray-100 md:dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400"
                        disabled={loading}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'tag', name: tag.name })}
                        className="btn-ghost px-2 py-1 text-xs md:text-xs md:bg-transparent md:hover:bg-gray-100 md:dark:hover:bg-gray-800 text-red-600 dark:text-red-400"
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
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Manage all your bookmark icons. Create presets for quick access when adding bookmarks.
              </div>
              <button
                onClick={() => setShowCreateModal({ type: 'icon' })}
                className="btn-primary text-sm whitespace-nowrap"
                disabled={loading}
              >
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Icon
              </button>
            </div>

            {icons.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  No icon presets found. Create your first icon preset to get started.
                </p>
                <button
                  onClick={() => setShowCreateModal({ type: 'icon' })}
                  className="btn-primary"
                  disabled={loading}
                >
                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Your First Icon Preset
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {icons.map((iconData) => (
                  <div
                    key={iconData.icon}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 gap-3 sm:gap-0"
                  >
                    <div className="flex items-center gap-3">
                      {iconData.icon.startsWith('http') ? (
                        <img
                          src={iconData.icon}
                          alt=""
                          width={32}
                          height={32}
                          className="rounded"
                          onError={(e) => {
                            // Fallback to text if image fails to load
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
                          {iconData.count > 0
                            ? `${iconData.count} bookmark${iconData.count !== 1 ? 's' : ''}`
                            : 'Not used yet'
                          }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => setEditingIcon({ old: iconData.icon, new: iconData.icon })}
                        className="btn-ghost px-2 py-1 text-xs md:text-xs md:bg-transparent md:hover:bg-gray-100 md:dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400"
                        disabled={loading}
                      >
                        Update
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'icon', name: iconData.icon })}
                        className="btn-ghost px-2 py-1 text-xs md:text-xs md:bg-transparent md:hover:bg-gray-100 md:dark:hover:bg-gray-800 text-red-600 dark:text-red-400"
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
        )}
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
        <Modal onClose={() => setEditingIcon(null)} title="Update Icon">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Icon character
              </label>
              <input
                type="text"
                value={editingIcon.new}
                onChange={(e) => setEditingIcon({ ...editingIcon, new: e.target.value })}
                className="input w-full text-center text-2xl"
                placeholder="🔖"
                autoFocus
                maxLength={2}
              />
              <p className="text-xs text-gray-500 mt-1">
                Use emoji or any single character
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditingIcon(null)}
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
              Are you sure you want to delete the {deleteConfirm.type} "{deleteConfirm.name}"?
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
        }} title="Create New Icon Preset">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Icon character
              </label>
              <input
                type="text"
                value={creatingIcon}
                onChange={(e) => setCreatingIcon(e.target.value)}
                className="input w-full text-center text-2xl"
                placeholder="🔖"
                autoFocus
                maxLength={2}
              />
              <p className="text-xs text-gray-500 mt-1">
                Use emoji or any single character. This will be available as a preset when creating bookmarks.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(null)
                  setCreatingIcon('')
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