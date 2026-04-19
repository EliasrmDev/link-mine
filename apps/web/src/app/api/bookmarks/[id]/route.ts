import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLS } from '@/lib/prisma'
import { requireAuth, badRequest, notFound, forbidden, normalizeTags } from '@/lib/api'
import { broadcastToUser } from '@/lib/sse'

const UpdateSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().min(1).max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  icon: z.string().max(500).nullable().optional(), // Increased limit for favicon URLs
  reminderDate: z.string().datetime().nullable().optional(),
  folderId: z.string().cuid().nullable().optional(),
})

// GET /api/bookmarks/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params

  return withRLS(auth.userId, async (tx) => {
    const bookmark = await tx.bookmark.findUnique({
      where: { id },
      include: { folder: { select: { id: true, name: true } } },
    })

    if (!bookmark) return notFound('Bookmark')
    if (bookmark.userId !== auth.userId) return forbidden()

    return NextResponse.json(bookmark)
  })
}

// PATCH /api/bookmarks/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { folderId, reminderDate, ...rest } = parsed.data

  // Process icon - handle favicon URLs
  let processedIcon = rest.icon !== undefined
    ? (rest.icon?.trim() || null)
    : undefined

  if (processedIcon?.startsWith('favicon:')) {
    processedIcon = processedIcon.substring(8)
  }

  if (processedIcon && !processedIcon.startsWith('http')) {
    processedIcon = processedIcon.slice(0, 10)
  }

  const normalizedRest = {
    ...rest,
    ...(processedIcon !== undefined ? { icon: processedIcon } : {}),
    ...(rest.tags ? { tags: normalizeTags(rest.tags) } : {}),
  }

  return withRLS(auth.userId, async (tx) => {
    const existing = await tx.bookmark.findUnique({ where: { id } })
    if (!existing) return notFound('Bookmark')
    if (existing.userId !== auth.userId) return forbidden()

    // Verify folder ownership if changing folder
    if (folderId !== undefined && folderId !== null) {
      const folder = await tx.folder.findFirst({
        where: { id: folderId, userId: auth.userId },
      })
      if (!folder) return badRequest('Folder not found')
    }

    try {
      const updated = await tx.bookmark.update({
        where: { id },
        data: {
          ...normalizedRest,
          ...(folderId !== undefined ? { folderId } : {}),
          ...(reminderDate !== undefined
            ? { reminderDate: reminderDate ? new Date(reminderDate) : null }
            : {}),
        },
        include: { folder: { select: { id: true, name: true } } },
      })

      if (normalizedRest.tags && normalizedRest.tags.length > 0) {
        await Promise.all(
          normalizedRest.tags.map((value) => tx.$executeRaw`
            INSERT INTO "public"."UserPreset" ("id", "userId", "type", "value", "createdAt")
            VALUES (${crypto.randomUUID()}, ${auth.userId}, 'TAG'::"public"."PresetType", ${value}, NOW())
            ON CONFLICT ("userId", "type", "value") DO NOTHING
          `),
        )
      }

      if (processedIcon && !processedIcon.startsWith('http')) {
        await tx.$executeRaw`
          INSERT INTO "public"."UserPreset" ("id", "userId", "type", "value", "createdAt")
          VALUES (${crypto.randomUUID()}, ${auth.userId}, 'ICON'::"public"."PresetType", ${processedIcon}, NOW())
          ON CONFLICT ("userId", "type", "value") DO NOTHING
        `
      }

      broadcastToUser(auth.userId, { type: 'bookmark:saved', bookmark: updated })
      return NextResponse.json(updated)
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e?.code === 'P2002') {
        return NextResponse.json({ error: 'Bookmark with this URL already exists' }, { status: 409 })
      }
      throw err
    }
  })
}

// DELETE /api/bookmarks/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params

  return withRLS(auth.userId, async (tx) => {
    const existing = await tx.bookmark.findUnique({ where: { id } })
    if (!existing) return notFound('Bookmark')
    if (existing.userId !== auth.userId) return forbidden()

    await tx.bookmark.delete({ where: { id } })
    broadcastToUser(auth.userId, { type: 'bookmark:deleted', id })
    return new NextResponse(null, { status: 204 })
  })
}
