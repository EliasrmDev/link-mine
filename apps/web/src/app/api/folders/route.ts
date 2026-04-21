import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLS } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'
import { broadcastToUser } from '@/lib/sse'

/** Maximum number of folders a user may own. */
const MAX_FOLDERS_PER_USER = 1000

const CreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  parentId: z.string().cuid().nullable().optional(),
})

type FolderRow = {
  id: string
  name: string
  parentId: string | null
  userId: string
  createdAt: Date
  updatedAt: Date
  _count: { bookmarks: number }
}

type NestedFolder = FolderRow & { children: NestedFolder[] }

/** Recursively build a folder tree from a flat list. */
function buildFolderTree(
  all: FolderRow[],
  parentId: string | null = null,
): NestedFolder[] {
  return all
    .filter((f) => f.parentId === parentId)
    .map((f) => ({ ...f, children: buildFolderTree(all, f.id) }))
}

// GET /api/folders — returns full recursive folder tree for the user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  return withRLS(auth.userId, async (tx) => {
    const folders = await tx.folder.findMany({
      where: { userId: auth.userId },
      include: { _count: { select: { bookmarks: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(buildFolderTree(folders as FolderRow[]), {
      headers: { 'Cache-Control': 'private, no-cache' },
    })
  })
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

  return withRLS(auth.userId, async (tx) => {
    // Enforce global folder limit
    const folderCount = await tx.folder.count({ where: { userId: auth.userId } })
    if (folderCount >= MAX_FOLDERS_PER_USER) {
      return badRequest(`You have reached the maximum of ${MAX_FOLDERS_PER_USER} folders`)
    }

    // Check for duplicate name in the same level
    const duplicate = await tx.folder.findFirst({
      where: { userId: auth.userId, parentId: parentId ?? null, name },
    })
    if (duplicate) return badRequest('A folder with this name already exists at this level')

    // Validate parent exists and belongs to the user
    if (parentId) {
      const parent = await tx.folder.findFirst({
        where: { id: parentId, userId: auth.userId },
      })
      if (!parent) return badRequest('Parent folder not found')
    }

    const folder = await tx.folder.create({
      data: { name, parentId: parentId ?? null, userId: auth.userId },
      include: { _count: { select: { bookmarks: true } } },
    })

    broadcastToUser(auth.userId, { type: 'folders:changed' })
    return NextResponse.json(folder, { status: 201 })
  })
}
