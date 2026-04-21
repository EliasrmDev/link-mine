import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, badRequest } from '@/lib/api'
import { withRLS } from '@/lib/prisma'

const BodySchema = z.object({
  icon: z.string().min(1).max(2048),
})

// DELETE /api/icons/delete
// Remove all instances of an icon from bookmarks and delete the preset entry.
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { icon } = parsed.data

  try {
    return await withRLS(auth.userId, async (tx) => {
      await tx.bookmark.updateMany({
        where: { userId: auth.userId, icon },
        data: { icon: null },
      })
      await tx.userPreset.deleteMany({
        where: { userId: auth.userId, type: 'ICON', value: icon },
      })
      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Failed to delete icon:', error)
    return NextResponse.json({ error: 'Failed to delete icon' }, { status: 500 })
  }
}