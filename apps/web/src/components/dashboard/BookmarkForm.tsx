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

export function BookmarkForm({ bookmark, folders, defaultFolderId, onSave, onClose }: Props) {
  const isEditing = !!bookmark
  const [url, setUrl] = useState(bookmark?.url ?? '')
  const [title, setTitle] = useState(bookmark?.title ?? '')
  const [tagInput, setTagInput] = useState(bookmark?.tags.join(', ') ?? '')
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
