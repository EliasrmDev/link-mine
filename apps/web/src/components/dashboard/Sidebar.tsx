'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Folder } from '@linkmine/shared'

interface Props {
  folders: Folder[]
  unsortedCount: number
  selectedFolderId: string | null | 'all'
  onSelectFolder: (id: string | null | 'all') => void
  onAddFolder: (parentId?: string | null) => void
  onEditFolder: (folder: Folder) => void
  onDeleteFolder: (id: string) => void
}

export function Sidebar({
  folders,
  unsortedCount,
  selectedFolderId,
  onSelectFolder,
  onAddFolder,
  onEditFolder,
  onDeleteFolder,
}: Props) {
  const totalBookmarksInTree = folders.reduce((sum, folder) => sum + countBookmarksInFolderTree(folder), 0)
  const allBookmarksCount = totalBookmarksInTree + unsortedCount

  return (
    <nav
      aria-label="Folders"
      className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <Link href="/">
          <span className="text-lg font-bold text-brand-400">LinkMine</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto gap-3 px-3 py-3">
        {/* All bookmarks */}
        <SidebarItem
          label="All bookmarks"
          count={allBookmarksCount}
          selected={selectedFolderId === 'all'}
          onSelect={() => onSelectFolder('all')}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          }
        />

        {/* Unsorted */}
        <SidebarItem
          label="Unsorted"
          selected={selectedFolderId === 'none'}
          onSelect={() => onSelectFolder('none')}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          }
        />

        {/* Folders */}
        {folders.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Folders
              </span>
              <button
                onClick={() => onAddFolder(null)}
                aria-label="Add folder"
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {folders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                selectedFolderId={selectedFolderId}
                onSelect={onSelectFolder}
                onAddChild={(parentId) => onAddFolder(parentId)}
                onEdit={onEditFolder}
                onDelete={onDeleteFolder}
              />
            ))}
          </div>
        )}

        {folders.length === 0 && (
          <button
            onClick={() => onAddFolder(null)}
            className="mt-4 flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 p-3 text-sm text-gray-400 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:hover:border-brand-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create first folder
          </button>
        )}
      </div>

      {/* Export */}
      <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-800">
        <a
          href="/api/bookmarks/export"
          download
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export bookmarks
        </a>
      </div>
    </nav>
  )
}

function countBookmarksInFolderTree(folder: Folder): number {
  const ownCount = folder._count?.bookmarks ?? 0
  const childrenCount = (folder.children ?? []).reduce(
    (sum, child) => sum + countBookmarksInFolderTree(child),
    0,
  )
  return ownCount + childrenCount
}

function SidebarItem({
  label,
  count,
  selected,
  onSelect,
  icon,
}: {
  label: string
  count?: number
  selected: boolean
  onSelect: () => void
  icon?: React.ReactNode
}) {
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? 'page' : undefined}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 mb-3 text-sm transition-colors ${
        selected
          ? 'bg-brand-50 font-medium text-brand-400 dark:bg-brand-900/30 dark:text-brand-300'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {icon}
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-gray-400">{count}</span>
      )}
    </button>
  )
}

function FolderItem({
  folder,
  selectedFolderId,
  onSelect,
  onAddChild,
  onEdit,
  onDelete,
}: {
  folder: Folder
  selectedFolderId: string | null | 'all'
  onSelect: (id: string) => void
  onAddChild: (parentId: string) => void
  onEdit: (folder: Folder) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const hasChildren = (folder.children?.length ?? 0) > 0

  return (
    <div>
      <div className="group flex items-center">
        {/* Expand/collapse toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          className={`shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ${!hasChildren ? 'invisible' : ''}`}
        >
          <svg
            className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={() => onSelect(folder.id)}
          aria-current={selectedFolderId === folder.id ? 'page' : undefined}
          className={`flex flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
            selectedFolderId === folder.id
              ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="flex-1 truncate text-left">{folder.name}</span>
          <span className="text-xs text-gray-400">{folder._count?.bookmarks ?? 0}</span>
        </button>

        {/* Context menu trigger */}
        <div className="relative opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={`Folder options for ${folder.name}`}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                {!folder.parentId && (
                  <button
                    role="menuitem"
                    onClick={() => { onAddChild(folder.id); setMenuOpen(false) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Add sub-folder
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={() => { onEdit(folder); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Rename
                </button>
                <button
                  role="menuitem"
                  onClick={() => { onDelete(folder.id); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sub-folders */}
      {hasChildren && expanded && (
        <div className="ml-4 border-l border-gray-100 pl-2 dark:border-gray-800">
          {folder.children!.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
