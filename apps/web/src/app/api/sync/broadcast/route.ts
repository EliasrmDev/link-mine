import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { broadcastToUser, type SyncEvent } from '@/lib/sse'

// POST /api/sync/broadcast - Notify web app of changes from extension
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()

    // Validate the event type and payload
    const allowedTypes = ['BOOKMARK_CREATED', 'BOOKMARK_UPDATED', 'BOOKMARK_DELETED']
    if (!allowedTypes.includes(body.type)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
    }

    let syncEvent: SyncEvent

    switch (body.type) {
      case 'BOOKMARK_CREATED':
      case 'BOOKMARK_UPDATED':
        syncEvent = { type: 'bookmark:saved', bookmark: body.bookmark }
        break
      case 'BOOKMARK_DELETED':
        syncEvent = { type: 'bookmark:deleted', id: body.id }
        break
      default:
        return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })
    }

    // Broadcast to the user's SSE stream
    broadcastToUser(auth.userId, syncEvent)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Broadcast error:', error)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}