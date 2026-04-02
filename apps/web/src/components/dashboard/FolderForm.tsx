'use client'

import { useState, useEffect, useRef } from 'react'
import type { Folder } from '@linkmine/shared'
import { Modal } from '../ui/Modal'

interface Props {
  folder?: Folder
  parentId?: string | null
  folders: Folder[]
  onSave: (savedFolder?: Folder) => void
  onClose: () => void
}

export function FolderForm({ folder, parentId, folders, onSave, onClose }: Props) {
  const isEditing = !!folder
  const [name, setName] = useState(folder?.name ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Folder name is required')
      return
    }

    setSaving(true)
    try {
      const body = isEditing
        ? { name }
        : { name, parentId: parentId ?? null }

      const res = await fetch(
        isEditing ? `/api/folders/${folder.id}` : '/api/folders',
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

      const data = await res.json().catch(() => null)
      onSave(data ?? undefined)
    } finally {
      setSaving(false)
    }
  }

  // Find parent name for context
  const parentFolder = parentId
    ? folders.find((f) => f.id === parentId) ??
      folders.flatMap((f) => f.children ?? []).find((c) => c.id === parentId)
    : null

  return (
    <Modal
      title={isEditing ? 'Rename folder' : parentId ? `Add sub-folder` : 'Create folder'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        {parentFolder && (
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Inside: <strong>{parentFolder.name}</strong>
          </p>
        )}

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="folder-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Folder name <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            ref={inputRef}
            id="folder-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Design Resources"
            className="input"
            aria-required="true"
            maxLength={100}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEditing ? 'Rename' : 'Create folder'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
