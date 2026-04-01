import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, badRequest, notFound, forbidden } from '@/lib/api'

const UpdateSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().min(1).max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  icon: z.string().max(10).nullable().optional(),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        ...rest,
        ...(folderId !== undefined ? { folderId } : {}),
        ...(reminderDate !== undefined
          ? { reminderDate: reminderDate ? new Date(reminderDate) : null }
          : {}),
      } as any,
      include: { folder: { select: { id: true, name: true } } },
    })
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
  return new NextResponse(null, { status: 204 })
}
