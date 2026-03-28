// ─── Domain types (shared between web app and extension) ─────────────────────

export interface Folder {
  id: string
  name: string
  parentId: string | null
  children?: Folder[]
  _count?: { bookmarks: number }
  createdAt: string
  updatedAt: string
}

export interface Bookmark {
  id: string
  url: string
  title: string
  tags: string[]
  folderId: string | null
  folder?: Pick<Folder, 'id' | 'name'>
  createdAt: string
  updatedAt: string
}

// ─── API request / response shapes ───────────────────────────────────────────

export interface CreateBookmarkInput {
  url: string
  title: string
  tags?: string[]
  folderId?: string | null
}

export interface UpdateBookmarkInput {
  url?: string
  title?: string
  tags?: string[]
  folderId?: string | null
}

export interface CreateFolderInput {
  name: string
  parentId?: string | null
}

export interface UpdateFolderInput {
  name?: string
  parentId?: string | null
}

export interface ApiError {
  error: string
}

export interface PaginatedBookmarks {
  bookmarks: Bookmark[]
  total: number
  page: number
  pageSize: number
}
