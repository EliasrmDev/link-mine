import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLS } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'
import { broadcastToUser } from '@/lib/sse'

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(200),
})

// POST /api/folders/bulk-delete
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = BulkDeleteSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { ids } = parsed.data

  return withRLS(auth.userId, async (tx) => {
    // Fetch all folders for this user to walk the tree
    const allUserFolders = await tx.folder.findMany({
      where: { userId: auth.userId },
      select: { id: true, parentId: true },
    })

    // Collect the selected folders and all their descendants
    const folderIdsToDelete = new Set<string>(ids)

    const collectDescendants = (parentId: string) => {
      for (const f of allUserFolders) {
        if (f.parentId === parentId && !folderIdsToDelete.has(f.id)) {
          folderIdsToDelete.add(f.id)
          collectDescendants(f.id)
        }
      }
    }
    for (const id of ids) {
      collectDescendants(id)
    }

    const idsToDelete = Array.from(folderIdsToDelete)

    // Delete all bookmarks that belong to any of those folders
    await tx.bookmark.deleteMany({
      where: { userId: auth.userId, folderId: { in: idsToDelete } },
    })

    // Delete all the folders
    const result = await tx.folder.deleteMany({
      where: { id: { in: idsToDelete } },
    })

    broadcastToUser(auth.userId, { type: 'folders:changed' })
    return NextResponse.json({ deleted: result.count })
  })
}
