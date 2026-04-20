'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { Sun, Moon, Download, Upload, ChevronDown } from 'lucide-react'
import { useTheme } from '../ThemeProvider'
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
  const { toggle } = useTheme()
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [foldersExpanded, setFoldersExpanded] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const totalBookmarksInTree = folders.reduce((sum, folder) => sum + countBookmarksInFolderTree(folder), 0)
  const allBookmarksCount = totalBookmarksInTree + unsortedCount

  return (
    <nav
      aria-label="Folders"
      className="flex w-full lg:w-64 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 h-full"
    >
      {/* Logo */}
      <div className="px-4 lg:px-5 py-4 border-b border-gray-100 dark:border-gray-800">
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
              <button
                onClick={() => setFoldersExpanded((e) => !e)}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-expanded={foldersExpanded}
                aria-controls="sidebar-folders-list"
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-200 ${foldersExpanded ? '' : '-rotate-90'}`}
                />
                Folders
              </button>
              {foldersExpanded && (
                <button
                  onClick={() => onAddFolder(null)}
                  aria-label="Add folder"
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>

            <div id="sidebar-folders-list">
              {foldersExpanded && folders.map((folder) => (
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

      {/* Footer with theme toggle and export */}
      <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-800 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute left-5 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="dark:hidden">Light mode</span>
          <span className="hidden dark:block">Dark mode</span>
        </button>

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 justify-between"
          >
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span>Export bookmarks</span>
            </div>
            <ChevronDown className={`h-3 w-3 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {exportMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setExportMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <a
                  href="/api/bookmarks/export?format=html"
                  download
                  onClick={() => setExportMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span className="text-blue-500">🌐</span>
                  <div>
                    <div className="font-medium">Para navegador</div>
                    <div className="text-xs text-gray-500">HTML</div>
                  </div>
                </a>
                <a
                  href="/api/bookmarks/export?format=csv"
                  download
                  onClick={() => setExportMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span className="text-green-500">📊</span>
                  <div>
                    <div className="font-medium">Para Excel</div>
                    <div className="text-xs text-gray-500">CSV</div>
                  </div>
                </a>
                <a
                  href="/api/bookmarks/export?format=markdown"
                  download
                  onClick={() => setExportMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span className="text-purple-500">📝</span>
                  <div>
                    <div className="font-medium">Para Notion/Obsidian</div>
                    <div className="text-xs text-gray-500">Markdown</div>
                  </div>
                </a>
                <a
                  href="/api/bookmarks/export?format=json"
                  download
                  onClick={() => setExportMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span className="text-orange-500">💾</span>
                  <div>
                    <div className="font-medium">Backup completo</div>
                    <div className="text-xs text-gray-500">JSON</div>
                  </div>
                </a>
                <a
                  href="/api/bookmarks/export?format=pdf"
                  download
                  onClick={() => setExportMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span className="text-red-500">📄</span>
                  <div>
                    <div className="font-medium">Documento PDF</div>
                    <div className="text-xs text-gray-500">PDF</div>
                  </div>
                </a>
              </div>
            </>
          )}
        </div>

        {/* Import dropdown */}
        <div className="relative">
          <button
            onClick={() => setImportMenuOpen(!importMenuOpen)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 justify-between"
            disabled={importing}
          >
            <div className="flex items-center gap-2">
              {importing ? (
                <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>{importing ? 'Importing...' : 'Import bookmarks'}</span>
            </div>
            <ChevronDown className={`h-3 w-3 transition-transform ${importMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {importMenuOpen && !importing && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setImportMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  onClick={() => {
                    fileInputRef.current?.setAttribute('accept', '.html')
                    fileInputRef.current?.click()
                    setImportMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span className="text-blue-500">🌐</span>
                  <div className="flex flex-col items-start">
                    <div className="font-medium">Desde navegador</div>
                    <div className="text-xs text-gray-500">HTML</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.setAttribute('accept', '.csv')
                    fileInputRef.current?.click()
                    setImportMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span className="text-green-500">📊</span>
                  <div className="flex flex-col items-start">
                    <div className="font-medium">Desde Excel</div>
                    <div className="text-xs text-gray-500">CSV</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.setAttribute('accept', '.md,.markdown')
                    fileInputRef.current?.click()
                    setImportMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span className="text-purple-500">📝</span>
                  <div className="flex flex-col items-start">
                    <div className="font-medium">Desde Notion/Obsidian</div>
                    <div className="text-xs text-gray-500">Markdown</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.setAttribute('accept', '.json')
                    fileInputRef.current?.click()
                    setImportMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span className="text-orange-500">💾</span>
                  <div className="flex flex-col items-start">
                    <div className="font-medium">Desde backup</div>
                    <div className="text-xs text-gray-500">JSON</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return

            setImporting(true)
            const formData = new FormData()
            formData.append('file', file)

            try {
              const response = await fetch('/api/bookmarks/import', {
                method: 'POST',
                body: formData,
              })

              const result = await response.json()

              if (response.ok) {
                alert(`Import successful!
Imported: ${result.imported} bookmarks
Skipped: ${result.skipped} (already exist)
Total processed: ${result.total}`)

                // Reload the page to show imported bookmarks
                window.location.reload()
              } else {
                alert(`Import failed: ${result.error || 'Unknown error'}`)
              }
            } catch (error) {
              alert(`Error importing bookmarks. Please check your file format and try again. Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
            } finally {
              setImporting(false)
              // Reset input
              e.target.value = ''
            }
          }}
        />
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
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={`Folder options for ${folder.name}`}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
