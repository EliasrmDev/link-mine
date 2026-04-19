import { NextRequest, NextResponse } from 'next/server'
import { withRLS } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

interface BookmarkData {
  url: string
  title: string
  tags: string[]
  folder: string
  createdAt: Date
}

function generateHTML(bookmarks: BookmarkData[]): string {
  // Group bookmarks by folder
  const groupedByFolder = bookmarks.reduce((acc, bookmark) => {
    const folderName = bookmark.folder
    if (!acc[folderName]) acc[folderName] = []
    acc[folderName].push(bookmark)
    return acc
  }, {} as Record<string, BookmarkData[]>)

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`

  // Add folders with their bookmarks
  Object.entries(groupedByFolder).forEach(([folderName, folderBookmarks]) => {
    html += `    <DT><H3>${folderName}</H3>\n`
    html += `    <DL><p>\n`

    folderBookmarks.forEach((bookmark: BookmarkData) => {
      html += `        <DT><A HREF="${bookmark.url}" ADD_DATE="${Math.floor(new Date(bookmark.createdAt).getTime() / 1000)}">${bookmark.title}</A>\n`
    })

    html += `    </DL><p>\n`
  })

  html += `</DL><p>`
  return html
}

function generateCSV(bookmarks: BookmarkData[]): string {
  const headers = ['Title', 'URL', 'Tags', 'Folder', 'Created Date']
  const rows = bookmarks.map((bookmark: BookmarkData) => [
    `"${bookmark.title.replace(/"/g, '""')}"`,
    `"${bookmark.url}"`,
    `"${bookmark.tags.join(', ')}"`,
    `"${bookmark.folder}"`,
    `"${new Date(bookmark.createdAt).toLocaleString()}"`
  ])

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}

function generateMarkdown(bookmarks: BookmarkData[]): string {
  const groupedByFolder = bookmarks.reduce((acc, bookmark) => {
    const folderName = bookmark.folder
    if (!acc[folderName]) acc[folderName] = []
    acc[folderName].push(bookmark)
    return acc
  }, {} as Record<string, BookmarkData[]>)

  let markdown = '# Bookmarks Export\n\n'

  Object.entries(groupedByFolder).forEach(([folder, bookmarks]) => {
    markdown += `## ${folder}\n\n`
    bookmarks.forEach((bookmark: BookmarkData) => {
      markdown += `- [${bookmark.title}](${bookmark.url})`
      if (bookmark.tags.length > 0) {
        markdown += ` #${bookmark.tags.join(' #')}`
      }
      markdown += '\n'
    })
    markdown += '\n'
  })

  return markdown
}

function generatePDF(bookmarks: BookmarkData[]): string {
  // For PDF, we'll return HTML that can be converted to PDF by the browser
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>BookMarks Export - LinkMine</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        h1 { color: #333; border-bottom: 2px solid #333; }
        h2 { color: #666; margin-top: 30px; }
        .bookmark { margin: 10px 0; padding: 10px; border-left: 3px solid #007acc; }
        .bookmark-title { font-weight: bold; color: #007acc; }
        .bookmark-url { color: #666; font-size: 0.9em; }
        .bookmark-tags { color: #888; font-size: 0.8em; }
        .export-info { color: #888; font-size: 0.9em; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>BookMarks Export</h1>
    <div class="export-info">Exported on ${new Date().toLocaleString()}</div>

    ${Object.entries(bookmarks.reduce((acc: Record<string, BookmarkData[]>, bookmark: BookmarkData) => {
      const folderName = bookmark.folder
      if (!acc[folderName]) acc[folderName] = []
      acc[folderName].push(bookmark)
      return acc
    }, {})).map(([folder, bookmarks]: [string, BookmarkData[]]) => `
    <h2>${folder}</h2>
    ${bookmarks.map((bookmark: BookmarkData) => `
    <div class="bookmark">
        <div class="bookmark-title">${bookmark.title}</div>
        <div class="bookmark-url">${bookmark.url}</div>
        ${bookmark.tags.length > 0 ? `<div class="bookmark-tags">Tags: ${bookmark.tags.join(', ')}</div>` : ''}
    </div>
    `).join('')}
    `).join('')}
</body>
</html>`
}

// GET /api/bookmarks/export — returns bookmarks in various formats
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'

  return withRLS(auth.userId, async (tx) => {
    const bookmarks = await tx.bookmark.findMany({
      where: { userId: auth.userId },
      include: { folder: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const exportBookmarks = bookmarks.map((b: { url: string; title: string; tags: string[]; folder: { id: string; name: string } | null; createdAt: Date }) => ({
      url: b.url,
      title: b.title,
      tags: b.tags,
      folder: b.folder?.name ?? 'Ungrouped',
      createdAt: b.createdAt,
    }))

  const timestamp = new Date().toISOString().split('T')[0]

  switch (format) {
    case 'html': {
      const htmlContent = generateHTML(exportBookmarks)
      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="linkmine-bookmarks-${timestamp}.html"`,
        },
      })
    }

    case 'csv': {
      const csvContent = generateCSV(exportBookmarks)
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="linkmine-bookmarks-${timestamp}.csv"`,
        },
      })
    }

    case 'markdown': {
      const markdownContent = generateMarkdown(exportBookmarks)
      return new NextResponse(markdownContent, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="linkmine-bookmarks-${timestamp}.md"`,
        },
      })
    }

    case 'pdf': {
      const pdfHtmlContent = generatePDF(exportBookmarks)
      return new NextResponse(pdfHtmlContent, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="linkmine-bookmarks-${timestamp}.html"`,
        },
      })
    }

    default: // json
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: 1,
        bookmarks: exportBookmarks,
      }

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="linkmine-bookmarks-${timestamp}.json"`,
        },
      })
    }
  })
}
