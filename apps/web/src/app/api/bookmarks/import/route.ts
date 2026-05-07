import { NextRequest, NextResponse } from 'next/server'
import { withRLS } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

/** Parsed bookmark with full folder hierarchy (empty array = no folder). */
type ParsedBookmark = {
  url: string
  title: string
  tags: string[]
  /** Ordered list of folder names from root to leaf, e.g. ['Work', 'Dev'] */
  folderPath: string[]
}

function parseHTML(htmlContent: string): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = []
  const folderStack: string[] = []
  // Tracks whether each DL level is a folder DL (true) or a non-folder DL (false, e.g. root).
  const dlIsFolderStack: boolean[] = []
  // H3 just seen — will be pushed onto folderStack when the next <DL> opens.
  let pendingFolder: string | null = null

  const content = htmlContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // One-pass token scanner over the full document string (not line-by-line).
  //
  // Alternation groups:
  //   match[1]       — H3 folder name
  //   (no groups)    — <DL> open  → identified by match[0].charAt(1) !== '/'
  //   (no groups)    — </DL> close → identified by match[0].charAt(1) === '/'
  //   match[2],[3]   — A href + title
  //
  // Tracking <DL> opens (not just closes) means the root <DL> (no H3) is
  // correctly recorded as a non-folder level, so its </DL> never pops a
  // real folder off the stack.
  const tokenRegex =
    /<H3[^>]*>([^<]+)<\/H3>|<DL\b[^>]*>|<\/DL\b[^>]*>|<A\b[^>]*\bHREF=["']([^"']+)["'][^>]*>([^<]*)<\/A>/gi

  let match: RegExpExecArray | null
  while ((match = tokenRegex.exec(content)) !== null) {
    if (match[1] !== undefined) {
      // <H3> — record pending folder name; the immediately following <DL>
      // will claim it as a folder-level list.
      pendingFolder = match[1].trim()
    } else if (match[2] !== undefined) {
      // <A HREF="url">title</A>
      const url = match[2].trim()
      const title = (match[3] ?? '').trim() || url
      bookmarks.push({ url, title, tags: [], folderPath: [...folderStack] })
    } else if (match[0].charAt(1) !== '/') {
      // <DL> open — if an H3 was just seen, this DL belongs to that folder.
      if (pendingFolder !== null) {
        folderStack.push(pendingFolder)
        dlIsFolderStack.push(true)
        pendingFolder = null
      } else {
        dlIsFolderStack.push(false)
      }
    } else {
      // </DL> close — only pop the folder stack if this DL owned a folder.
      if (dlIsFolderStack.pop()) folderStack.pop()
    }
  }

  return bookmarks
}

function parseCSV(csvContent: string): ParsedBookmark[] {
  const lines = csvContent.split('\n').filter(line => line.trim())
  const bookmarks: ParsedBookmark[] = []

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const matches = line.match(/("(?:[^"]+|"")*"|[^,]*),?/g)

    if (matches && matches.length >= 2) {
      const title = matches[0]?.replace(/^"|"$/g, '').replace(/""/g, '"') || ''
      const url = matches[1]?.replace(/^"|"$/g, '').replace(/""/g, '"') || ''
      const tags = matches[2]?.replace(/^"|"$/g, '').replace(/""/g, '"').split(',').map(t => t.trim()).filter(Boolean) || []
      const folder = matches[3]?.replace(/^"|"$/g, '').replace(/""/g, '"') || ''

      if (url && title) {
        bookmarks.push({ url: url.trim(), title: title.trim(), tags, folderPath: folder && folder !== 'Ungrouped' ? [folder] : [] })
      }
    }
  }

  return bookmarks
}

function parseMarkdown(markdownContent: string): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = []

  // Regex to match markdown links with optional tags
  const linkRegex = /- \[([^\]]+)\]\(([^)]+)\)(?:\s+#(.+))?/g
  let match

  while ((match = linkRegex.exec(markdownContent)) !== null) {
    const [, title, url, tagString] = match
    const tags = tagString ? tagString.split(' #').map(tag => tag.trim()).filter(Boolean) : []

    if (url && title) {
      bookmarks.push({
        url: url.trim(),
        title: title.trim(),
        tags,
        folderPath: [],
      })
    }
  }

  return bookmarks
}

function parseJSON(jsonContent: string): ParsedBookmark[] {
  try {
    const data = JSON.parse(jsonContent)

    // Handle LinkMine export format
    type RawEntry = Record<string, unknown>
    if (data.bookmarks && Array.isArray(data.bookmarks)) {
      return (data.bookmarks as RawEntry[]).map((b) => {
        const folder = b.folder ? String(b.folder) : ''
        return {
          url: String(b.url ?? ''),
          title: String(b.title ?? ''),
          tags: Array.isArray(b.tags) ? (b.tags as unknown[]).map(String) : [],
          folderPath: folder && folder !== 'Ungrouped' ? [folder] : [],
        }
      })
    }

    // Handle generic array format
    if (Array.isArray(data)) {
      return (data as RawEntry[]).map((b) => {
        const folder = b.folder ? String(b.folder) : ''
        return {
          url: String(b.url ?? ''),
          title: String(b.title ?? b.name ?? ''),
          tags: Array.isArray(b.tags) ? (b.tags as unknown[]).map(String) : [],
          folderPath: folder && folder !== 'Ungrouped' ? [folder] : [],
        }
      })
    }

    return []
  } catch {
    return []
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const fileContent = await file.text()
    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    let bookmarksToImport: ParsedBookmark[] = []

    switch (fileExtension) {
      case 'html':
      case 'htm':
        bookmarksToImport = parseHTML(fileContent)
        break

      case 'csv':
        bookmarksToImport = parseCSV(fileContent)
        break

      case 'md':
      case 'markdown':
        bookmarksToImport = parseMarkdown(fileContent)
        break

      case 'json':
        bookmarksToImport = parseJSON(fileContent)
        break

      default:
        return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 })
    }

    if (bookmarksToImport.length === 0) {
      return NextResponse.json({ error: 'No valid bookmarks found in file' }, { status: 400 })
    }

    return await withRLS(auth.userId, async (tx) => {
      // ── Nested folder creation ────────────────────────────────────────────
      // Collect every ancestor path so parents are always created before children.
      // e.g. folderPath ['Work', 'Dev'] produces paths ['Work'] and ['Work', 'Dev'].
      const allPaths = new Set<string>()
      for (const b of bookmarksToImport) {
        for (let depth = 1; depth <= b.folderPath.length; depth++) {
          allPaths.add(b.folderPath.slice(0, depth).join('\x00'))
        }
      }

      // Sort by depth so parents are always processed before children.
      const sortedPaths = [...allPaths].sort(
        (a, b) => a.split('\x00').length - b.split('\x00').length
      )

      // Map from path-key → folder id, built as we find/create each folder.
      const folderIdMap = new Map<string, string>()

      for (const pathKey of sortedPaths) {
        const segments = pathKey.split('\x00')
        const name = segments[segments.length - 1]
        const parentKey = segments.length > 1 ? segments.slice(0, -1).join('\x00') : null
        const parentId = parentKey ? (folderIdMap.get(parentKey) ?? null) : null

        const existing = await tx.folder.findFirst({
          where: { userId: auth.userId, name, parentId },
          select: { id: true },
        })

        if (existing) {
          folderIdMap.set(pathKey, existing.id)
        } else {
          const created = await tx.folder.create({
            data: { name, userId: auth.userId, parentId },
            select: { id: true },
          })
          folderIdMap.set(pathKey, created.id)
        }
      }

      // Batch-check existing URLs instead of N+1 lookups per bookmark
      const allUrls = bookmarksToImport.map(b => b.url)
      const existingBookmarks = await tx.bookmark.findMany({
        where: { userId: auth.userId, url: { in: allUrls } },
        select: { url: true },
      })
      const existingUrlSet = new Set(existingBookmarks.map(b => b.url))

      const newBookmarks = bookmarksToImport.filter(b => !existingUrlSet.has(b.url))
      const skippedCount = bookmarksToImport.length - newBookmarks.length

      let importedCount = 0
      if (newBookmarks.length > 0) {
        const result = await tx.bookmark.createMany({
          data: newBookmarks.map(bookmark => ({
            url: bookmark.url,
            title: bookmark.title,
            tags: bookmark.tags,
            userId: auth.userId,
            folderId: bookmark.folderPath.length > 0
              ? (folderIdMap.get(bookmark.folderPath.join('\x00')) ?? null)
              : null,
          })),
          skipDuplicates: true,
        })
        importedCount = result.count
      }

      return NextResponse.json({
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        total: bookmarksToImport.length
      })
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Failed to import bookmarks' }, { status: 500 })
  }
}