import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

function parseHTML(htmlContent: string): Array<{url: string, title: string, tags: string[], folder?: string}> {
  const bookmarks: Array<{url: string, title: string, tags: string[], folder?: string}> = []

  // Clean and normalize the HTML content
  const cleanHtml = htmlContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Stack to track current folder hierarchy
  const folderStack: string[] = []

  // Split content into lines for easier parsing
  const lines = cleanHtml.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Check for folder start (H3 tag)
    const folderMatch = line.match(/<H3[^>]*>([^<]+)<\/H3>/i)
    if (folderMatch) {
      const folderName = folderMatch[1].trim()
      folderStack.push(folderName)
      continue
    }

    // Check for folder end (closing DL tag)
    if (line.match(/<\/DL>/i)) {
      if (folderStack.length > 0) {
        folderStack.pop()
      }
      continue
    }

    // Check for bookmark link
    const linkMatch = line.match(/<A[^>]+HREF=[\"']([^\"']+)[\"'][^>]*>([^<]+)<\/A>/i)
    if (linkMatch) {
      const [, url, title] = linkMatch
      if (url && title) {
        bookmarks.push({
          url: url.trim(),
          title: title.trim(),
          tags: [],
          folder: folderStack.length > 0 ? folderStack[folderStack.length - 1] : 'Ungrouped'
        })
      }
    }
  }

  return bookmarks
}

function parseCSV(csvContent: string): Array<{url: string, title: string, tags: string[], folder?: string}> {
  const lines = csvContent.split('\n').filter(line => line.trim())
  const bookmarks: Array<{url: string, title: string, tags: string[], folder?: string}> = []

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const matches = line.match(/("(?:[^"]+|"")*"|[^,]*),?/g)

    if (matches && matches.length >= 2) {
      const title = matches[0]?.replace(/^"|"$/g, '').replace(/""/g, '"') || ''
      const url = matches[1]?.replace(/^"|"$/g, '').replace(/""/g, '"') || ''
      const tags = matches[2]?.replace(/^"|"$/g, '').replace(/""/g, '"').split(',').map(t => t.trim()).filter(Boolean) || []
      const folder = matches[3]?.replace(/^"|"/g, '').replace(/""/g, '"') || 'Ungrouped'

      if (url && title) {
        bookmarks.push({ url: url.trim(), title: title.trim(), tags, folder })
      }
    }
  }

  return bookmarks
}

function parseMarkdown(markdownContent: string): Array<{url: string, title: string, tags: string[], folder?: string}> {
  const bookmarks: Array<{url: string, title: string, tags: string[], folder?: string}> = []

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
        folder: 'Ungrouped'
      })
    }
  }

  return bookmarks
}

function parseJSON(jsonContent: string): Array<{url: string, title: string, tags: string[], folder?: string}> {
  try {
    const data = JSON.parse(jsonContent)

    // Handle LinkMine export format
    if (data.bookmarks && Array.isArray(data.bookmarks)) {
      return data.bookmarks.map((b: any) => ({
        url: b.url,
        title: b.title,
        tags: Array.isArray(b.tags) ? b.tags : [],
        folder: b.folder || 'Ungrouped'
      }))
    }

    // Handle generic array format
    if (Array.isArray(data)) {
      return data.map((b: any) => ({
        url: b.url,
        title: b.title || b.name,
        tags: Array.isArray(b.tags) ? b.tags : [],
        folder: b.folder || 'Ungrouped'
      }))
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

    let bookmarksToImport: Array<{url: string, title: string, tags: string[], folder?: string}> = []

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

    // Create folders if they don't exist and get folder mapping
    const folderMap = new Map<string, string>()
    const uniqueFolders = [...new Set(
      bookmarksToImport
        .map(b => b.folder)
        .filter(folder => folder && folder !== 'Ungrouped')
    )] as string[]

    for (const folderName of uniqueFolders) {
      const existingFolder = await prisma.folder.findFirst({
        where: { name: folderName, userId: auth.userId }
      })

      if (existingFolder) {
        folderMap.set(folderName, existingFolder.id)
      } else {
        const newFolder = await prisma.folder.create({
          data: {
            name: folderName,
            userId: auth.userId,
            parentId: null
          }
        })
        folderMap.set(folderName, newFolder.id)
      }
    }

    // Import bookmarks
    let importedCount = 0
    let skippedCount = 0

    for (const bookmark of bookmarksToImport) {
      try {
        // Check if bookmark already exists
        const existing = await prisma.bookmark.findFirst({
          where: {
            url: bookmark.url,
            userId: auth.userId
          }
        })

        if (existing) {
          skippedCount++
          continue
        }

        // Create bookmark
        await prisma.bookmark.create({
          data: {
            url: bookmark.url,
            title: bookmark.title,
            tags: bookmark.tags,
            userId: auth.userId,
            folderId: (bookmark.folder && bookmark.folder !== 'Ungrouped') ? folderMap.get(bookmark.folder) : null
          }
        })

        importedCount++
      } catch (error) {
        console.error('Error importing bookmark:', bookmark.url, error)
        skippedCount++
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      total: bookmarksToImport.length
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Failed to import bookmarks' }, { status: 500 })
  }
}