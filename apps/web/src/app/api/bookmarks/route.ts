import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, badRequest, normalizeTags } from '@/lib/api'
import { broadcastToUser } from '@/lib/sse'

const CreateSchema = z.object({
  url: z.string().url('Invalid URL'),
  title: z.string().min(1, 'Title is required').max(500),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  icon: z.string().max(500).nullable().optional(), // Increased limit for favicon URLs
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

  const where = {
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
  const orderBy =
    sortBy === 'createdAt'
      ? { createdAt: sortDir }
      : { [sortBy]: { sort: sortDir, nulls: sortDir === 'asc' ? 'first' : 'last' } }

  const [bookmarks, total] = await Promise.all([
    prisma.bookmark.findMany({
      where,
      include: { folder: { select: { id: true, name: true } } },
      orderBy,
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

  const { url, title, tags, icon, reminderDate, folderId } = parsed.data
  const normalizedTags = normalizeTags(tags)

  // Process icon - handle different icon types
  let processedIcon = icon?.trim() || null

  // Only limit simple emoji/text icons to 10 chars
  // Allow URLs (http/https), data URLs, chrome-extension URLs, and file extensions
  if (processedIcon &&
      !processedIcon.startsWith('http') &&
      !processedIcon.startsWith('data:') &&
      !processedIcon.startsWith('chrome-extension:') &&
      !processedIcon.includes('.') &&
      !/^[a-zA-Z]+:\/\//.test(processedIcon)) {
    processedIcon = processedIcon.slice(0, 10)
  }

  // Verify folder ownership if provided
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: auth.userId },
    })
    if (!folder) return badRequest('Folder not found')
  }

  try {
    const bookmark = await prisma.bookmark.create({
      data: {
        url,
        title,
        tags: normalizedTags,
        icon: processedIcon,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        folderId: folderId ?? null,
        userId: auth.userId,
      },
      include: { folder: { select: { id: true, name: true } } },
    })

    if (normalizedTags.length > 0) {
      await Promise.all(
        normalizedTags.map((value) => prisma.$executeRaw`
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

    // Notify any open dashboard tabs for this user
    broadcastToUser(auth.userId, { type: 'bookmark:saved', bookmark })

    return NextResponse.json(bookmark, { status: 201 })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'P2002') {
      // Find the existing bookmark and return it
      const existingBookmark = await prisma.bookmark.findFirst({
        where: {
          userId: auth.userId,
          url: url
        },
        include: { folder: { select: { id: true, name: true } } }
      })

      return NextResponse.json({
        error: 'This URL has already been bookmarked',
        existingBookmark,
        message: 'You can edit the existing bookmark instead'
      }, { status: 409 })
    }
    throw err
  }
}
