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
  icon: string | null
  reminderDate: string | null
  lastAccessed: string | null
  folderId: string | null
  folder?: Pick<Folder, 'id' | 'name'>
  createdAt: string
  updatedAt: string
}

export interface TreeNodeData {
  id: string;
  title: string;
  href?: string;
  children?: TreeNodeData[];
  defaultExpanded?: boolean;
}

// ─── API request / response shapes ───────────────────────────────────────────

export interface CreateBookmarkInput {
  url: string
  title: string
  tags?: string[]
  icon?: string | null
  reminderDate?: string | null
  folderId?: string | null
}

export interface UpdateBookmarkInput {
  url?: string
  title?: string
  tags?: string[]
  icon?: string | null
  reminderDate?: string | null
  lastAccessed?: string | null
  folderId?: string | null
}

export interface BookmarkFilters {
  q?: string
  tags?: string[]
  icon?: string
  hasReminder?: boolean
  sortBy?: 'createdAt' | 'reminderDate' | 'lastAccessed'
  sortDir?: 'asc' | 'desc'
  folderId?: string | null | 'all'
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

// ─── Domain-based nested links system ────────────────────────────────────────

export interface DomainGroupedBookmark extends Bookmark {
  isParent?: boolean
  children?: Bookmark[]
  domain: string
}

export interface DomainGroupingPreference {
  domain: string
  grouped: boolean
}
