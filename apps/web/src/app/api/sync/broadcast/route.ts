import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, badRequest } from '@/lib/api'
import { broadcastToUser, type SyncEvent } from '@/lib/sse'

const BookmarkPayloadSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
}).passthrough()

const BroadcastSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('BOOKMARK_CREATED'),
    bookmark: BookmarkPayloadSchema,
  }),
  z.object({
    type: z.literal('BOOKMARK_UPDATED'),
    bookmark: BookmarkPayloadSchema,
  }),
  z.object({
    type: z.literal('BOOKMARK_DELETED'),
    id: z.string().min(1),
  }),
])

// POST /api/sync/broadcast - Notify web app of changes from extension
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = BroadcastSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  let syncEvent: SyncEvent

  switch (parsed.data.type) {
    case 'BOOKMARK_CREATED':
    case 'BOOKMARK_UPDATED':
      syncEvent = { type: 'bookmark:saved', bookmark: parsed.data.bookmark }
      break
    case 'BOOKMARK_DELETED':
      syncEvent = { type: 'bookmark:deleted', id: parsed.data.id }
      break
  }

  broadcastToUser(auth.userId, syncEvent)

  return NextResponse.json({ success: true })
}