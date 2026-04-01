import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, badRequest, notFound, forbidden } from '@/lib/api'
import { broadcastToUser } from '@/lib/sse'

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().cuid().nullable().optional(),
})

// PATCH /api/folders/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const existing = await prisma.folder.findUnique({ where: { id } })
  if (!existing) return notFound('Folder')
  if (existing.userId !== auth.userId) return forbidden()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { name, parentId } = parsed.data

  // Check for duplicate name in the same level
  if (name) {
    const targetParentId = parentId !== undefined ? parentId : existing.parentId
    const duplicate = await prisma.folder.findFirst({
      where: { userId: auth.userId, parentId: targetParentId, name, NOT: { id } },
    })
    if (duplicate) return badRequest('A folder with this name already exists')
  }

  // Enforce max 2 levels when changing parent
  if (parentId !== undefined && parentId !== null) {
    if (parentId === id) return badRequest('Folder cannot be its own parent')
    const parent = await prisma.folder.findFirst({
      where: { id: parentId, userId: auth.userId },
    })
    if (!parent) return badRequest('Parent folder not found')
    if (parent.parentId) return badRequest('Maximum folder depth (2 levels) reached')
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
    },
    include: { _count: { select: { bookmarks: true } } },
  })

  broadcastToUser(auth.userId, { type: 'folders:changed' })
  return NextResponse.json(updated)
}

// DELETE /api/folders/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { id } = await params
  const existing = await prisma.folder.findUnique({ where: { id } })
  if (!existing) return notFound('Folder')
  if (existing.userId !== auth.userId) return forbidden()

  // Bookmarks in this folder will have folderId set to null (SetNull rule in schema)
  await prisma.folder.delete({ where: { id } })
  broadcastToUser(auth.userId, { type: 'folders:changed' })
  return new NextResponse(null, { status: 204 })
}
