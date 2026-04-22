import React from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { withRLS } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'
import { BookmarksDocument, type BookmarkData } from '@/documents/BookmarksDocument'

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

async function generatePDF(bookmarks: BookmarkData[]): Promise<Buffer> {
  const exportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Render the React document template to full HTML (with Paged.js embedded)
  const { renderAsync } = await import('@htmldocs/render')
  let html = await renderAsync(
    <BookmarksDocument
      bookmarks={bookmarks}
      exportDate={exportDate}
      totalCount={bookmarks.length}
    />,
  )

  // Replace the CDN reference to paged.polyfill.js with the local node_modules copy
  // to avoid network dependency and prevent Playwright networkidle from timing out.
  const { readFile } = await import('fs/promises')
  const { resolve } = await import('path')
  const pagedJsPath = resolve(
    process.cwd(),
    '../../node_modules/@htmldocs/render/dist/paged.polyfill.js',
  )
  const pagedJsContent = await readFile(pagedJsPath, 'utf8')
  html = html.replace(
    /<script[^>]+src="https:\/\/unpkg\.com[^"]*paged[^"]*"[^>]*><\/script>/i,
    `<script>${pagedJsContent}</script>`,
  )

  // Use Playwright Chromium to convert the HTML to a PDF buffer
  const { chromium } = await import('playwright')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    // networkidle waits for Paged.js to finish laying out pages
    await page.setContent(html, { waitUntil: 'networkidle' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
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
      const pdfBuffer = await generatePDF(exportBookmarks)
      return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="linkmine-bookmarks-${timestamp}.pdf"`,
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
