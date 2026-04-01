'use client'

import { useState, useEffect, useRef } from 'react'
import type { Bookmark, Folder } from '@savepath/shared'
import { Modal } from '../ui/Modal'

interface Props {
  bookmark?: Bookmark
  folders: Folder[]
  defaultFolderId: string | null
  onSave: () => void
  onClose: () => void
}

const PRESET_ICONS = ['🔖', '📌', '⭐', '🔥', '📚', '💡', '🎯', '🛠️', '📝', '🔗']

export function BookmarkForm({ bookmark, folders, defaultFolderId, onSave, onClose }: Props) {
  const isEditing = !!bookmark
  const [url, setUrl] = useState(bookmark?.url ?? '')
  const [title, setTitle] = useState(bookmark?.title ?? '')
  const [tagInput, setTagInput] = useState(bookmark?.tags.join(', ') ?? '')
  const [icon, setIcon] = useState(bookmark?.icon ?? '')
  const [reminderDate, setReminderDate] = useState(
    bookmark?.reminderDate ? bookmark.reminderDate.slice(0, 10) : '',
  )
  const [folderId, setFolderId] = useState<string>(
    bookmark?.folderId ?? defaultFolderId ?? '',
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  // Flatten folder tree for select
  const folderOptions = folders.flatMap((f) => [
    { id: f.id, name: f.name, depth: 0 },
    ...(f.children ?? []).map((c) => ({ id: c.id, name: c.name, depth: 1 })),
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    setSaving(true)
    try {
      const body = {
        url,
        title,
        tags,
        icon: icon || null,
        reminderDate: reminderDate ? new Date(reminderDate).toISOString() : null,
        folderId: folderId || null,
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
        setError(data.error ?? 'Something went wrong')
        return
      }

      onSave()
    } finally {
      setSaving(false)
    }
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

        <div className="space-y-4">
          <div>
            <label htmlFor="bm-url" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              URL <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              ref={firstInputRef}
              id="bm-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="input"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="bm-title" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="bm-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
              className="input"
              aria-required="true"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Icon
            </label>
            <div className="flex flex-wrap items-center gap-1">
              {PRESET_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(icon === emoji ? '' : emoji)}
                  className={`rounded p-1 text-base leading-none transition-colors ${
                    icon === emoji
                      ? 'bg-brand-100 ring-1 ring-brand-500 dark:bg-brand-900/40'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  aria-label={`Icon ${emoji}`}
                  aria-pressed={icon === emoji}
                >
                  {emoji}
                </button>
              ))}
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 10))}
                placeholder="custom"
                maxLength={10}
                className="input w-20 py-1 text-center"
                aria-label="Custom icon"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bm-tags" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tags
            </label>
            <input
              id="bm-tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="design, tools, reading (comma-separated)"
              className="input"
            />
          </div>

          {/* Reminder date */}
          <div>
            <label htmlFor="bm-reminder" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reminder date
            </label>
            <input
              id="bm-reminder"
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
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
            <label htmlFor="bm-folder" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Folder
            </label>
            <select
              id="bm-folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="input"
            >
              <option value="">No folder</option>
              {folderOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.depth === 1 ? '  └ ' : ''}{f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add bookmark'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
