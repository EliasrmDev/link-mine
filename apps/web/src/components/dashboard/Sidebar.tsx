'use client'

import { signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, Download, Upload, ChevronDown, Settings, LogOut, Bookmark, Inbox, Plus, ChevronRight, FolderIcon, Folders, MoreVertical, PanelLeftDashed, Circle } from 'lucide-react'
import { useTheme } from '../ThemeProvider'
import type { Folder } from '@linkmine/shared'

type SidebarMode = 'toggle' | 'hover'

interface Props {
  user: { name: string; image: string | null }
  folders: Folder[]
  unsortedCount: number
  selectedFolderId: string | null | 'all'
  onSelectFolder: (id: string | null | 'all') => void
  onAddFolder: (parentId?: string | null) => void
  onEditFolder: (folder: Folder) => void
  onDeleteFolder: (id: string) => void
  sidebarMode: SidebarMode
  onSidebarModeChange: (mode: SidebarMode) => void
  sidebarExpanded?: boolean
  onToggleSidebar?: () => void
}

export function Sidebar({
  user,
  folders,
  unsortedCount,
  selectedFolderId,
  onSelectFolder,
  onAddFolder,
  onEditFolder,
  onDeleteFolder,
  sidebarMode,
  onSidebarModeChange,
  sidebarExpanded,
  onToggleSidebar,
}: Props) {
  const { toggle } = useTheme()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [foldersExpanded, setFoldersExpanded] = useState(true)
  const [controlMenuOpen, setControlMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setUserMenuOpen(false)
      setExportMenuOpen(false)
      setImportMenuOpen(false)
      setControlMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const totalBookmarksInTree = folders.reduce((sum, folder) => sum + countBookmarksInFolderTree(folder), 0)
  const allBookmarksCount = totalBookmarksInTree + unsortedCount
  const collapsed = !sidebarExpanded

  return (
    <nav
      aria-label="Folders"
      className={`flex w-full shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 h-full transition-width duration-300 ${collapsed ? 'lg:w-14' : 'lg:w-64'}`}
    >
      {/* Logo */}
      <div className={`py-4 border-b border-gray-100 dark:border-gray-800 flex items-center transition-all duration-300 ${collapsed ? 'lg:justify-center lg:px-2 px-4 justify-between' : 'px-4 lg:px-5 justify-between'}`}>
        <Link href="/" className={`transition-opacity duration-300 truncate w-full ${collapsed ? 'lg:hidden' : ''}`}>
          <span className="text-lg font-bold text-brand-400">LinkMine</span>
        </Link>

        {/* Sidebar display control */}
        <div className="relative hidden sm:flex items-center border border-gray-200 dark:border-gray-700 rounded-lg px-1 py-1 transition-colors bg-white dark:bg-gray-800">
          <button
            onClick={() => {
              if (sidebarMode === 'toggle') {
                onToggleSidebar?.()
              } else {
                return // No toggle action for hover mode; sidebar expands on hover automatically
              }
            }}
            aria-label={`Sidebar mode: ${sidebarMode}. Click to toggle`}
            title={`Current: ${sidebarMode}${sidebarMode === 'toggle' ? ` (${sidebarExpanded ? 'expanded' : 'collapsed'})` : ''} — click to toggle`}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <PanelLeftDashed className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            onClick={() => setControlMenuOpen((o) => !o)}
            aria-label="Sidebar display options"
            aria-haspopup="true"
            aria-expanded={controlMenuOpen}
            className="w-3.5 h-6 flex items-center justify-center border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${controlMenuOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
          </button>

          {controlMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setControlMenuOpen(false)} aria-hidden="true" />
              <div
                role="group"
                className="absolute top-full z-20 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">Sidebar control</div>
                <hr className="-mx-1 my-1 border-gray-200 dark:border-gray-700" />
                {([
                  { mode: 'toggle', label: 'Toggle' },
                  { mode: 'hover', label: 'Expand on hover' },
                ] as const).map(({ mode, label }) => (
                  <button
                    key={mode}
                    role="menuitemradio"
                    aria-checked={sidebarMode === mode}
                    onClick={() => { onSidebarModeChange(mode); setControlMenuOpen(false) }}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 outline-none"
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      {sidebarMode === mode && (
                        <Circle className="h-2 w-2 fill-current" aria-hidden="true" />
                      )}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden gap-3 py-3 transition-all duration-300 ${collapsed ? 'lg:px-1 px-3' : 'px-3'}`}>
        {/* All bookmarks */}
        <SidebarItem
          label="All bookmarks"
          count={allBookmarksCount}
          selected={selectedFolderId === 'all'}
          onSelect={() => onSelectFolder('all')}
          icon={<Bookmark className="h-4 w-4" aria-hidden="true" />}
          collapsed={collapsed}
        />

        {/* Unsorted */}
        <SidebarItem
          label="Unsorted"
          selected={selectedFolderId === 'none'}
          onSelect={() => onSelectFolder('none')}
          icon={<Inbox className="h-4 w-4" aria-hidden="true" />}
          collapsed={collapsed}
        />

        {/* Folders */}
        {folders.length > 0 && (
          <div className="mt-3">
            <div className={`flex gap-1.5 items-center justify-between px-2 py-1 transition-all duration-300 ${collapsed ? 'flex-col p-0' : ''}`}>
              <button
                onClick={() => collapsed ? onToggleSidebar?.() : setFoldersExpanded((e) => !e)}
                className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${collapsed ? 'flex-col' : ''}`}
                aria-expanded={foldersExpanded}
                aria-controls="sidebar-folders-list"
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-200 ${collapsed ? 'lg:hidden' : ''} ${foldersExpanded ? '' : '-rotate-90'}`}
                />
                <Folders className="h-4 w-4" aria-hidden="true" />
                <span className={`${collapsed ? 'lg:hidden' : ''}`}>Folders</span>
              </button>
              {foldersExpanded && (
                <button
                  onClick={() => onAddFolder(null)}
                  aria-label="Add folder"
                  className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Full folder tree — always on mobile; desktop only when not collapsed */}
            <div className={collapsed ? 'lg:hidden' : ''} id="sidebar-folders-list">
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
            className={`mt-4 flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 p-3 text-sm text-gray-400 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:hover:border-brand-700 ${collapsed ? 'lg:hidden' : ''}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">Create first folder</span>
          </button>
        )}
      </div>

      {/* Footer with theme toggle and export */}
      <div className={`border-t border-gray-100 py-3 dark:border-gray-800 space-y-1 ${collapsed ? 'lg:px-1 px-3' : 'px-3'}`}>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title='Toggle theme'
          className={`flex w-full ${collapsed ? 'justify-center' : ''} items-center gap-3 px-3 rounded-lg py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800`}
        >
          <Sun className="dark:hidden h-4 w-4 rotate-0 scale-100 transition-all dark:absolute dark:left-5 dark:-rotate-90 dark:scale-0" />
          <Moon className="dark:block hidden h-4 w-4" />
          <span className={`dark:hidden truncate ${collapsed ? 'lg:hidden' : ''}`}>Light mode</span>
          <span className={`hidden dark:block truncate ${collapsed ? 'lg:!hidden' : ''}`}>Dark mode</span>
        </button>

        {/* Export dropdown */}
        <div className="relative">
          {collapsed ? (
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              aria-label="Export bookmarks"
              aria-expanded={exportMenuOpen}
              aria-haspopup="true"
              className="flex w-full items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 justify-between"
            >
              <div className="flex items-center gap-2 w-full">
                <Download className="h-4 w-4" />
                <span className="truncate">Export bookmarks</span>
              </div>
              <ChevronDown className={`h-3 w-3 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {exportMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setExportMenuOpen(false)}
                aria-hidden="true"
              />
              <div className={`absolute z-20 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
                collapsed
                  ? 'bottom-0 left-full ml-1 w-52'
                  : 'bottom-full left-0 right-0 mb-2'
              }`}>
                <a href="/api/bookmarks/export?format=html" download onClick={() => setExportMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <span className="text-blue-500">🌐</span>
                  <div><div className="font-medium">Para navegador</div><div className="text-xs text-gray-500">HTML</div></div>
                </a>
                <a href="/api/bookmarks/export?format=csv" download onClick={() => setExportMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <span className="text-green-500">📊</span>
                  <div><div className="font-medium">Para Excel</div><div className="text-xs text-gray-500">CSV</div></div>
                </a>
                <a href="/api/bookmarks/export?format=markdown" download onClick={() => setExportMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <span className="text-purple-500">📝</span>
                  <div><div className="font-medium">Para Notion/Obsidian</div><div className="text-xs text-gray-500">Markdown</div></div>
                </a>
                <a href="/api/bookmarks/export?format=json" download onClick={() => setExportMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <span className="text-orange-500">💾</span>
                  <div><div className="font-medium">Backup completo</div><div className="text-xs text-gray-500">JSON</div></div>
                </a>
                <a href="/api/bookmarks/export?format=pdf" download onClick={() => setExportMenuOpen(false)} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <span className="text-red-500">📄</span>
                  <div><div className="font-medium">Documento PDF</div><div className="text-xs text-gray-500">PDF</div></div>
                </a>
              </div>
            </>
          )}
        </div>

        {/* Import dropdown */}
        <div className="relative">
          {collapsed ? (
            <button
              onClick={() => setImportMenuOpen(!importMenuOpen)}
              aria-label="Import bookmarks"
              aria-expanded={importMenuOpen}
              aria-haspopup="true"
              disabled={importing}
              className="flex w-full items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {importing
                ? <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                : <Upload className="h-4 w-4" aria-hidden="true" />}
            </button>
          ) : (
            <button
              onClick={() => setImportMenuOpen(!importMenuOpen)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 justify-between"
              disabled={importing}
            >
              <div className="flex items-center gap-2 w-full">
                {importing
                  ? <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                  : <Upload className="h-4 w-4" />}
                <span className={`truncate ${collapsed ? 'lg:hidden lg:opacity-0' : 'lg:opacity-100'}`}>{importing ? 'Importing...' : 'Import bookmarks'}</span>
              </div>
              <ChevronDown className={`h-3 w-3 transition-transform ${importMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {importMenuOpen && !importing && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setImportMenuOpen(false)}
                aria-hidden="true"
              />
              <div className={`absolute z-20 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
                collapsed
                  ? 'bottom-0 left-full ml-1 w-52'
                  : 'bottom-full left-0 right-0 mb-2'
              }`}>
                <button onClick={() => { fileInputRef.current?.setAttribute('accept', '.html'); fileInputRef.current?.click(); setImportMenuOpen(false) }} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <span className="text-blue-500">🌐</span>
                  <div className="flex flex-col items-start"><div className="font-medium">Desde navegador</div><div className="text-xs text-gray-500">HTML</div></div>
                </button>
                <button onClick={() => { fileInputRef.current?.setAttribute('accept', '.csv'); fileInputRef.current?.click(); setImportMenuOpen(false) }} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <span className="text-green-500">📊</span>
                  <div className="flex flex-col items-start"><div className="font-medium">Desde Excel</div><div className="text-xs text-gray-500">CSV</div></div>
                </button>
                <button onClick={() => { fileInputRef.current?.setAttribute('accept', '.md,.markdown'); fileInputRef.current?.click(); setImportMenuOpen(false) }} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <span className="text-purple-500">📝</span>
                  <div className="flex flex-col items-start"><div className="font-medium">Desde Notion/Obsidian</div><div className="text-xs text-gray-500">Markdown</div></div>
                </button>
                <button onClick={() => { fileInputRef.current?.setAttribute('accept', '.json'); fileInputRef.current?.click(); setImportMenuOpen(false) }} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
                  <span className="text-orange-500">💾</span>
                  <div className="flex flex-col items-start"><div className="font-medium">Desde backup</div><div className="text-xs text-gray-500">JSON</div></div>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="relative pt-1">
          <button
            onClick={() => setUserMenuOpen((open) => !open)}
            className={`flex w-full items-center gap-3 px-3 rounded-lg py-2 text-left text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            {user.image ? (
              <Image
                src={user.image}
                alt=""
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {user.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className={`flex-1 truncate ${collapsed ? 'lg:hidden' : ''}`}>{user.name || 'User profile'}</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${userMenuOpen ? 'rotate-180' : ''} ${collapsed ? 'lg:hidden' : ''}`} />
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setUserMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className={`absolute z-20 rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 dark:border-gray-700 dark:bg-gray-800 ${
                  collapsed
                    ? 'bottom-0 left-full ml-1 w-44'
                    : 'bottom-full left-0 right-0 mb-2'
                }`}
              >
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <hr className="my-1 border-gray-200 dark:border-gray-700" />
                <button
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:text-red-400 dark:hover:bg-gray-700"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
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
  collapsed,
}: {
  label: string
  count?: number
  selected: boolean
  onSelect: () => void
  icon?: React.ReactNode
  collapsed?: boolean
}) {
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={`flex w-full items-center rounded-lg py-2 mb-1 text-sm transition-colors ${
        collapsed ? 'lg:justify-center lg:px-2 gap-2 px-3' : 'gap-2 px-3'
      } ${
        selected
          ? 'bg-brand-50 font-medium text-brand-400 dark:bg-brand-900/30 dark:text-brand-300'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {icon}
      <span className={`flex-1 truncate text-left ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
      {count !== undefined && (
        <span className={`text-xs text-gray-400 ${collapsed ? 'lg:hidden' : ''}`}>{count}</span>
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

  useEffect(() => {
    if (!menuOpen) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  return (
    <div>
      <div className="group flex items-center">
        {/* Expand/collapse toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          className={`shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ${!hasChildren ? 'invisible' : ''}`}
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" />
        </button>

        <button
          onClick={() => onSelect(folder.id)}
          aria-current={selectedFolderId === folder.id ? 'page' : undefined}
          className={`flex flex-1 w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
            selectedFolderId === folder.id
              ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          <FolderIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate text-left">{folder.name}</span>
          <span className="text-xs text-gray-400">{folder._count?.bookmarks ?? 0}</span>
        </button>

        {/* Context menu trigger */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={`Folder options for ${folder.name}`}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className="rounded w-8 p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div
                role="menu"
                className="absolute bottom-full right-0 z-20 mt-1 w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <button
                  role="menuitem"
                  onClick={() => { onAddChild(folder.id); setMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Add sub-folder
                </button>
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
