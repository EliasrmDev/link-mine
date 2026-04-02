import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

// GET /api/tags — returns unique lowercase tags used by the user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: auth.userId },
    select: { tags: true },
  })

  const set = new Set<string>()
  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags) {
      const value = tag.trim().toLowerCase()
      if (value) set.add(value)
    }
  }

  return NextResponse.json({ tags: Array.from(set).sort() })
}
