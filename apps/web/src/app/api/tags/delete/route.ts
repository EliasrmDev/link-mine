import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLS } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'

const BodySchema = z.object({
  tag: z.string().min(1).max(50),
})

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { tag } = parsed.data

  try {
    return await withRLS(auth.userId, async (tx) => {
      const result = await tx.$executeRaw`
        UPDATE "public"."Bookmark"
        SET "tags" = array_remove("tags", ${tag})
        WHERE "userId" = ${auth.userId}
          AND ${tag} = ANY("tags")
      `
      await tx.userPreset.deleteMany({
        where: { userId: auth.userId, type: 'TAG', value: tag },
      })
      return NextResponse.json({ success: true, updated: result })
    })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}