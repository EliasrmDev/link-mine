import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'

const CreateSchema = z.object({
  url: z.string().url('Invalid URL'),
  title: z.string().min(1, 'Title is required').max(500),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  icon: z.string().max(10).nullable().optional(),
  reminderDate: z.string().datetime().nullable().optional(),
  folderId: z.string().cuid().nullable().optional(),
})

const QuerySchema = z.object({
  q: z.string().optional(),
  folderId: z.string().optional(), // 'none' | cuid
  tags: z.string().optional(),     // comma-separated tag list
  icon: z.string().optional(),
  hasReminder: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['createdAt', 'reminderDate', 'lastAccessed']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// GET /api/bookmarks
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { q, folderId, tags, icon, hasReminder, sortBy, sortDir, page, pageSize } = parsed.data

  // Parse comma-separated tags into array
  const tagList = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []

  const where: Record<string, unknown> = {
    userId: auth.userId,
    ...(folderId === 'none' ? { folderId: null } : folderId ? { folderId } : {}),
    ...(tagList.length > 0 ? { tags: { hasSome: tagList } } : {}),
    ...(icon ? { icon } : {}),
    ...(hasReminder === 'true' ? { reminderDate: { not: null } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { url: { contains: q, mode: 'insensitive' as const } },
            { tags: { hasSome: [q] } },
          ],
        }
      : {}),
  }

  // Build orderBy — nullable fields sort nulls first (asc) or last (desc)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderBy: any =
    sortBy === 'createdAt'
      ? { createdAt: sortDir }
      : { [sortBy]: { sort: sortDir, nulls: sortDir === 'asc' ? 'first' : 'last' } }

  const [bookmarks, total] = await Promise.all([
    prisma.bookmark.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: where as any,
      include: { folder: { select: { id: true, name: true } } },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.bookmark.count({ where: where as any }),
  ])

  return NextResponse.json({ bookmarks, total, page, pageSize })
}

// POST /api/bookmarks
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { url, title, tags, icon, reminderDate, folderId } = parsed.data

  // Verify folder ownership if provided
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: auth.userId },
    })
    if (!folder) return badRequest('Folder not found')
  }

  try {
    const bookmark = await prisma.bookmark.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        url,
        title,
        tags,
        icon: icon ?? null,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        folderId: folderId ?? null,
        userId: auth.userId,
      } as any,
      include: { folder: { select: { id: true, name: true } } },
    })
    return NextResponse.json(bookmark, { status: 201 })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Bookmark already exists' }, { status: 409 })
    }
    throw err
  }
}
