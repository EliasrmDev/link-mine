import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'
import { broadcastToUser } from '@/lib/sse'

const CreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  parentId: z.string().cuid().nullable().optional(),
})

// GET /api/folders — returns full folder tree for the user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const folders = await prisma.folder.findMany({
    where: { userId: auth.userId },
    include: { _count: { select: { bookmarks: true } } },
    orderBy: { createdAt: 'asc' },
  })

  type FolderRow = (typeof folders)[number]

  // Build tree (max 2 levels)
  const roots = folders
    .filter((f: FolderRow) => !f.parentId)
    .map((f: FolderRow) => ({
      ...f,
      children: folders.filter((c: FolderRow) => c.parentId === f.id),
    }))

  return NextResponse.json(roots)
}

// POST /api/folders
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { name, parentId } = parsed.data

  // Check for duplicate name in the same level
  const duplicate = await prisma.folder.findFirst({
    where: { userId: auth.userId, parentId: parentId ?? null, name },
  })
  if (duplicate) return badRequest('A folder with this name already exists')

  // Enforce max 2 levels
  if (parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: parentId, userId: auth.userId },
    })
    if (!parent) return badRequest('Parent folder not found')
    if (parent.parentId) return badRequest('Maximum folder depth (2 levels) reached')
  }

  const folder = await prisma.folder.create({
    data: { name, parentId: parentId ?? null, userId: auth.userId },
    include: { _count: { select: { bookmarks: true } } },
  })

  broadcastToUser(auth.userId, { type: 'folders:changed' })
  return NextResponse.json(folder, { status: 201 })
}
