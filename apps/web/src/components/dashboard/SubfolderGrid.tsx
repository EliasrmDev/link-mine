'use client'

import type { Folder } from '@linkmine/shared'

function countBookmarksInFolderTree(folder: Folder): number {
  const ownCount = folder._count?.bookmarks ?? 0
  const childrenCount = (folder.children ?? []).reduce(
    (sum, child) => sum + countBookmarksInFolderTree(child),
    0,
  )
  return ownCount + childrenCount
}

interface Props {
  subfolders: Folder[]
  onNavigate: (folderId: string) => void
  onEdit: (folder: Folder) => void
  onDelete: (folderId: string) => void
  className?: string
}

export function SubfolderGrid({ subfolders, onNavigate, onEdit, onDelete, className = '' }: Props) {
  if (subfolders.length === 0) return null

  return (
    <section className={`${className}`} aria-label="Subfolders">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          Subfolders
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {subfolders.length} folder{subfolders.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {subfolders.map((folder) => {
          const bookmarkCount = countBookmarksInFolderTree(folder)

          return (
            <div
              key={folder.id}
              className="group card flex flex-col p-4 transition hover:shadow-md cursor-pointer"
              onClick={() => onNavigate(folder.id)}
            >
              {/* Folder Icon and Name */}
              <div className="flex items-start gap-3">
                <span className="text-blue-500 dark:text-blue-400 mt-1" aria-hidden="true">
                  📁
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400">
                    {folder.name}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {bookmarkCount} bookmark{bookmarkCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Actions (shown on hover) */}
              <div className="mt-3 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(folder)
                  }}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  aria-label={`Edit folder: ${folder.name}`}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(folder.id)
                  }}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                  aria-label={`Delete folder: ${folder.name}`}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}