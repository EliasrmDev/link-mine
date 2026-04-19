import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLS } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'

const BodySchema = z.object({
  oldTag: z.string().min(1).max(50),
  newTag: z.string().min(1).max(50),
})

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { oldTag, newTag } = parsed.data
  const normalizedNew = newTag.trim().toLowerCase()

  try {
    return await withRLS(auth.userId, async (tx) => {
      const result = await tx.$executeRaw`
        UPDATE "public"."Bookmark"
        SET "tags" = array_replace("tags", ${oldTag}, ${normalizedNew})
        WHERE "userId" = ${auth.userId}
          AND ${oldTag} = ANY("tags")
      `
      await tx.$executeRaw`
        INSERT INTO "public"."UserPreset" ("id", "userId", "type", "value", "createdAt")
        VALUES (${crypto.randomUUID()}, ${auth.userId}, 'TAG'::"public"."PresetType", ${normalizedNew}, NOW())
        ON CONFLICT ("userId", "type", "value") DO NOTHING
      `
      await tx.userPreset.deleteMany({
        where: { userId: auth.userId, type: 'TAG', value: oldTag },
      })
      return NextResponse.json({ success: true, updated: result })
    })
  } catch (error) {
    console.error('Error renaming tag:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}