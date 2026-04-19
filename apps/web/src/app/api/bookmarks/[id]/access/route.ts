import { NextRequest, NextResponse } from 'next/server'
import { withRLS } from '@/lib/prisma'
import { requireAuth, notFound, forbidden } from '@/lib/api'

// PATCH /api/bookmarks/:id/access — fire-and-forget lastAccessed update
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params

  return withRLS(auth.userId, async (tx) => {
    const existing = await tx.bookmark.findUnique({ where: { id }, select: { userId: true } })
    if (!existing) return notFound('Bookmark')
    if (existing.userId !== auth.userId) return forbidden()

    await tx.bookmark.update({
      where: { id },
      data: { lastAccessed: new Date() },
    })

    return new NextResponse(null, { status: 204 })
  })
}
