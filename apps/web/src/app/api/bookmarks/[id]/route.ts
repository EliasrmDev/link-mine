import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
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
  const bookmark = await prisma.bookmark.findUnique({
    where: { id },
    include: { folder: { select: { id: true, name: true } } },
  })

  if (!bookmark) return notFound('Bookmark')
  if (bookmark.userId !== auth.userId) return forbidden()

  return NextResponse.json(bookmark)
}

// PATCH /api/bookmarks/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const existing = await prisma.bookmark.findUnique({ where: { id } })
  if (!existing) return notFound('Bookmark')
  if (existing.userId !== auth.userId) return forbidden()

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
    // Extract the favicon URL and store just the URL
    processedIcon = processedIcon.substring(8) // Remove 'favicon:' prefix
  }

  // Limit emoji icons to 10 chars, but allow longer URLs for favicons
  if (processedIcon && !processedIcon.startsWith('http')) {
    processedIcon = processedIcon.slice(0, 10)
  }

  const normalizedRest = {
    ...rest,
    ...(processedIcon !== undefined ? { icon: processedIcon } : {}),
    ...(rest.tags ? { tags: normalizeTags(rest.tags) } : {}),
  }

  // Verify folder ownership if changing folder
  if (folderId !== undefined && folderId !== null) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: auth.userId },
    })
    if (!folder) return badRequest('Folder not found')
  }

  try {
    const updated = await prisma.bookmark.update({
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
        normalizedRest.tags.map((value) => prisma.$executeRaw`
          INSERT INTO "public"."UserPreset" ("id", "userId", "type", "value", "createdAt")
          VALUES (${crypto.randomUUID()}, ${auth.userId}, 'TAG'::"public"."PresetType", ${value}, NOW())
          ON CONFLICT ("userId", "type", "value") DO NOTHING
        `),
      )
    }

    // Only save non-favicon icons as presets (emojis, not URLs)
    if (processedIcon && !processedIcon.startsWith('http')) {
      await prisma.$executeRaw`
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
}

// DELETE /api/bookmarks/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const existing = await prisma.bookmark.findUnique({ where: { id } })
  if (!existing) return notFound('Bookmark')
  if (existing.userId !== auth.userId) return forbidden()

  await prisma.bookmark.delete({ where: { id } })
  broadcastToUser(auth.userId, { type: 'bookmark:deleted', id })
  return new NextResponse(null, { status: 204 })
}
