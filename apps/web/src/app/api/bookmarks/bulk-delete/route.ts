import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLS } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'
import { broadcastToUser } from '@/lib/sse'

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(500),
})

// POST /api/bookmarks/bulk-delete
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = BulkDeleteSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { ids } = parsed.data

  return withRLS(auth.userId, async (tx) => {
    const result = await tx.bookmark.deleteMany({
      where: { id: { in: ids }, userId: auth.userId },
    })

    broadcastToUser(auth.userId, { type: 'bookmarks:bulk-deleted', ids })
    return NextResponse.json({ deleted: result.count })
  })
}
