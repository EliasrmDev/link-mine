import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLS } from '@/lib/prisma'
import { requireAuth, badRequest, notFound, forbidden } from '@/lib/api'
import { broadcastToUser } from '@/lib/sse'

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().cuid().nullable().optional(),
})

type FlatFolder = { id: string; parentId: string | null }

/**
 * Returns true if `candidateId` is a descendant of `ancestorId` within the
 * provided flat folder list.  Used to detect move cycles.
 */
function isDescendantOf(
  allFolders: FlatFolder[],
  ancestorId: string,
  candidateId: string,
): boolean {
  const children = allFolders.filter((f) => f.parentId === ancestorId)
  for (const child of children) {
    if (child.id === candidateId) return true
    if (isDescendantOf(allFolders, child.id, candidateId)) return true
  }
  return false
}

// PATCH /api/folders/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params

  return withRLS(auth.userId, async (tx) => {
    const existing = await tx.folder.findUnique({ where: { id } })
    if (!existing) return notFound('Folder')
    if (existing.userId !== auth.userId) return forbidden()

    const body = await request.json().catch(() => null)
    if (!body) return badRequest('Invalid JSON body')

    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const { name, parentId } = parsed.data

    // Check for duplicate name in the target level
    if (name !== undefined || parentId !== undefined) {
      const targetParentId = parentId !== undefined ? parentId : existing.parentId
      const targetName = name !== undefined ? name : existing.name
      const duplicate = await tx.folder.findFirst({
        where: { userId: auth.userId, parentId: targetParentId, name: targetName, NOT: { id } },
      })
      if (duplicate) return badRequest('A folder with this name already exists at this level')
    }

    // Validate parent change
    if (parentId !== undefined && parentId !== null) {
      if (parentId === id) return badRequest('A folder cannot be its own parent')

      const parent = await tx.folder.findFirst({
        where: { id: parentId, userId: auth.userId },
      })
      if (!parent) return badRequest('Parent folder not found')

      // Cycle detection: the new parent must not be a descendant of this folder
      const allFolders = await tx.folder.findMany({
        where: { userId: auth.userId },
        select: { id: true, parentId: true },
      })
      if (isDescendantOf(allFolders as FlatFolder[], id, parentId)) {
        return badRequest('Cannot move a folder into one of its own sub-folders (cycle detected)')
      }
    }

    const updated = await tx.folder.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(parentId !== undefined ? { parentId } : {}),
      },
      include: { _count: { select: { bookmarks: true } } },
    })

    broadcastToUser(auth.userId, { type: 'folders:changed' })
    return NextResponse.json(updated)
  })
}

// DELETE /api/folders/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params

  return withRLS(auth.userId, async (tx) => {
    const existing = await tx.folder.findUnique({ where: { id } })
    if (!existing) return notFound('Folder')
    if (existing.userId !== auth.userId) return forbidden()

    await tx.folder.delete({ where: { id } })
    broadcastToUser(auth.userId, { type: 'folders:changed' })
    return new NextResponse(null, { status: 204 })
  })
}
