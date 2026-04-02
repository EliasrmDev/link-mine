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
  onTagRenamed: (oldName: string, newName: string) => Promise<void>
  onTagDeleted: (tagName: string) => Promise<void>
  onIconUpdated: (oldIcon: string, newIcon: string) => Promise<void>
  onTagCreated: (tagName: string) => Promise<void>
  onIconCreated: (icon: string) => Promise<void>
}

export function TagsIconsManager({ allTags, iconsInUse, onTagRenamed, onTagDeleted, onIconUpdated, onTagCreated, onIconCreated }: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [icons, setIcons] = useState<IconData[]>([])
  const [activeTab, setActiveTab] = useState<'tags' | 'icons'>('tags')
  const [editingTag, setEditingTag] = useState<{ old: string; new: string } | null>(null)
  const [editingIcon, setEditingIcon] = useState<{ old: string; new: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'tag' | 'icon'; name: string } | null>(null)
  const [creatingTag, setCreatingTag] = useState<string>('')
  const [creatingIcon, setCreatingIcon] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState<{ type: 'tag' | 'icon' } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch tag counts and icon counts
    fetchTagCounts()
    fetchIconCounts()
  }, [allTags, iconsInUse])

  const fetchTagCounts = async () => {
    try {
      // Get all tag presets
      const presetsResponse = await fetch('/api/presets')
      const presets = presetsResponse.ok ? await presetsResponse.json() : { tags: [] }

      // Get tag usage counts
      const countsResponse = await fetch('/api/tags?counts=true')
      const usageCounts = countsResponse.ok ? await countsResponse.json() : []

      // Create a map of usage counts
      const countMap = new Map<string, number>()
      usageCounts.forEach((tag: { name: string; count: number }) => {
        countMap.set(tag.name, tag.count)
      })

      // Combine all preset tags with their usage counts
      const allTags = presets.tags.map((tagName: string) => ({
        name: tagName,
        count: countMap.get(tagName) || 0
      }))

      // Sort by count (descending) then by name (ascending)
      allTags.sort((a: { name: string; count: number }, b: { name: string; count: number }) => b.count - a.count || a.name.localeCompare(b.name))

      setTags(allTags)
    } catch (error) {
      console.error('Error fetching tag counts:', error)
      // Fallback: use allTags with count 0
      setTags(allTags.map(tag => ({ name: tag, count: 0 })))
    }
  }

  const fetchIconCounts = async () => {
    try {
      // Get all icon presets
      const presetsResponse = await fetch('/api/presets')
      const presets = presetsResponse.ok ? await presetsResponse.json() : { icons: [] }

      // Create a map of usage counts from iconsInUse
      const countMap = new Map<string, number>()
      iconsInUse.forEach(icon => {
        if (icon) {
          countMap.set(icon, (countMap.get(icon) || 0) + 1)
        }
      })

      // Combine all preset icons with their usage counts
      const allIcons = presets.icons.map((icon: string) => ({
        icon,
        count: countMap.get(icon) || 0
      }))

      // Sort by count (descending) then by icon (ascending)
      allIcons.sort((a: { icon: string; count: number }, b: { icon: string; count: number }) => b.count - a.count || a.icon.localeCompare(b.icon))

      setIcons(allIcons)
    } catch (error) {
      console.error('Error processing icons:', error)
      // Fallback
      const uniqueIcons = [...new Set(iconsInUse.filter(Boolean))]
      const iconData = uniqueIcons.map(icon => ({
        icon,
        count: iconsInUse.filter(i => i === icon).length
      }))
      setIcons(iconData)
    }
  }

  const handleRenameTag = async () => {
    if (!editingTag || !editingTag.new.trim()) return

    setLoading(true)
    try {
      await onTagRenamed(editingTag.old, editingTag.new.trim())
      await fetchTagCounts()
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
      await fetchTagCounts()
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
      await fetchIconCounts()
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
      await fetchTagCounts()
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
      await fetchIconCounts()
      setCreatingIcon('')
      setShowCreateModal(null)
    } catch (error) {
      console.error('Error creating icon:', error)
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
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tags' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Manage all your bookmark tags. Create presets for quick access when adding bookmarks.
              </div>
              <button
                onClick={() => setShowCreateModal({ type: 'tag' })}
                className="btn-primary text-sm"
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
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingTag({ old: tag.name, new: tag.name })}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        disabled={loading}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'tag', name: tag.name })}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
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
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Manage all your bookmark icons. Create presets for quick access when adding bookmarks.
              </div>
              <button
                onClick={() => setShowCreateModal({ type: 'icon' })}
                className="btn-primary text-sm"
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
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{iconData.icon}</span>
                      <div className="text-sm">
                        <div className="text-gray-500">
                          {iconData.count > 0
                            ? `${iconData.count} bookmark${iconData.count !== 1 ? 's' : ''}`
                            : 'Not used yet'
                          }
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingIcon({ old: iconData.icon, new: iconData.icon })}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      disabled={loading}
                    >
                      Update
                    </button>
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
                onClick={handleDeleteTag}
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