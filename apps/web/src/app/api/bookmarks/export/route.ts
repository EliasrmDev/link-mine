import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

// GET /api/bookmarks/export — returns all bookmarks as JSON
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: auth.userId },
    include: { folder: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    bookmarks: bookmarks.map((b) => ({
      url: b.url,
      title: b.title,
      tags: b.tags,
      folder: b.folder?.name ?? null,
      createdAt: b.createdAt,
    })),
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="savepath-bookmarks.json"',
    },
  })
}
