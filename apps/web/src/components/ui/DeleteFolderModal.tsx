'use client'

interface Props {
  folderName: string
  hasContents: boolean
  onFolderOnly: () => void
  onCascade: () => void
  onCancel: () => void
}

/**
 * Confirmation dialog for folder deletion.
 * When the folder has contents (bookmarks or sub-folders) the user chooses
 * between moving them up one level or deleting everything.
 */
export function DeleteFolderModal({
  folderName,
  hasContents,
  onFolderOnly,
  onCascade,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-folder-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2
          id="delete-folder-title"
          className="text-base font-semibold text-gray-900 dark:text-white"
        >
          Delete &ldquo;{folderName}&rdquo;?
        </h2>

        {hasContents ? (
          <>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This folder contains bookmarks or sub-folders. What would you like to do?
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                autoFocus
                onClick={onFolderOnly}
                className="btn-secondary w-full justify-center"
              >
                Delete folder only
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                  (move contents up)
                </span>
              </button>
              <button
                onClick={onCascade}
                className="btn-danger w-full justify-center"
              >
                Delete everything
              </button>
              <button
                onClick={onCancel}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 py-1"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This folder will be permanently removed. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button autoFocus onClick={onCancel} className="btn-secondary">
                Cancel
              </button>
              <button onClick={onCascade} className="btn-danger">
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
