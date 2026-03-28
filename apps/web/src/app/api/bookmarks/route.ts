import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'

const CreateSchema = z.object({
  url: z.string().url('Invalid URL'),
  title: z.string().min(1, 'Title is required').max(500),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  folderId: z.string().cuid().nullable().optional(),
})

const QuerySchema = z.object({
  q: z.string().optional(),
  folderId: z.string().optional(), // 'none' | cuid
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// GET /api/bookmarks?q=&folderId=&page=&pageSize=
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { q, folderId, page, pageSize } = parsed.data

  const where = {
    userId: auth.userId,
    ...(folderId === 'none' ? { folderId: null } : folderId ? { folderId } : {}),
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

  const [bookmarks, total] = await Promise.all([
    prisma.bookmark.findMany({
      where,
      include: { folder: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.bookmark.count({ where }),
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

  const { url, title, tags, folderId } = parsed.data

  // Verify folder ownership if provided
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: auth.userId },
    })
    if (!folder) return badRequest('Folder not found')
  }

  try {
    const bookmark = await prisma.bookmark.create({
      data: { url, title, tags, folderId: folderId ?? null, userId: auth.userId },
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
