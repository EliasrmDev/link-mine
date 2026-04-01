/**
 * GET /api/sync/stream
 *
 * Server-Sent Events endpoint. The web dashboard connects here once on mount
 * and receives push notifications whenever a bookmark or folder changes for the
 * authenticated user — including changes made from the Chrome extension.
 *
 * Authentication: NextAuth session cookie is sent automatically by EventSource.
 * The endpoint is only reachable by the web dashboard (not the extension).
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api'
import { subscribeUser } from '@/lib/sse'

export const dynamic = 'force-dynamic'

const HEARTBEAT_MS = 25_000 // 25 s — keep connection alive through proxies

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const enc = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(enc.encode(data))
        } catch {
          // Controller already closed — ignore
        }
      }

      // Initial comment to flush headers immediately
      send(': connected\n\n')

      // Push sync events to this client
      const unsubscribe = subscribeUser(auth.userId, (event) => {
        send(`data: ${JSON.stringify(event)}\n\n`)
      })

      // Keep-alive heartbeat (SSE comments are ignored by EventSource)
      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS)

      // Cleanup when the client disconnects
      const cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
        try { controller.close() } catch { /* already closed */ }
      }

      request.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':     'text/event-stream',
      'Cache-Control':    'no-cache, no-transform',
      'X-Accel-Buffering': 'no', // Disable nginx response buffering
      Connection:          'keep-alive',
    },
  })
}
