import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, notFound, forbidden } from '@/lib/api'

// PATCH /api/bookmarks/:id/access — fire-and-forget lastAccessed update
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const existing = await prisma.bookmark.findUnique({ where: { id }, select: { userId: true } })
  if (!existing) return notFound('Bookmark')
  if (existing.userId !== auth.userId) return forbidden()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.bookmark.update({
    where: { id },
    data: { lastAccessed: new Date() } as any,
  })

  return new NextResponse(null, { status: 204 })
}
