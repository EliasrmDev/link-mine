/**
 * In-process Server-Sent Events broadcast bus.
 *
 * Each authenticated user has a channel keyed by their userId.
 * When a bookmark or folder mutation happens, call broadcastToUser()
 * from the API route; the SSE stream for that user will deliver the event.
 *
 * ⚠️  Scaling note: this EventEmitter lives in a single Node.js process.
 * For multi-instance deployments (e.g. PM2 cluster, Kubernetes) replace the
 * emitter with a Redis pub/sub adapter so events reach all replicas.
 */

import { EventEmitter } from 'events'
import { z } from 'zod'

const bus = new EventEmitter()
bus.setMaxListeners(2000) // allow many concurrent connections

// ─── Event shapes ─────────────────────────────────────────────────────────────

export type SyncEvent =
  | { type: 'bookmark:saved';   bookmark: Record<string, unknown> }
  | { type: 'bookmark:deleted'; id: string }
  | { type: 'folders:changed' }

const SyncEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bookmark:saved'), bookmark: z.record(z.unknown()) }),
  z.object({ type: z.literal('bookmark:deleted'), id: z.string() }),
  z.object({ type: z.literal('folders:changed') }),
])

// ─── Broadcast ───────────────────────────────────────────────────────────────

export function broadcastToUser(userId: string, event: SyncEvent): void {
  const result = SyncEventSchema.safeParse(event)
  if (!result.success) {
    console.error('SSE: invalid event shape, skipping broadcast:', result.error.issues)
    return
  }
  bus.emit(`u:${userId}`, event)
}

// ─── Subscribe ───────────────────────────────────────────────────────────────

/** Returns an unsubscribe function */
export function subscribeUser(
  userId: string,
  handler: (event: SyncEvent) => void,
): () => void {
  const key = `u:${userId}`
  bus.on(key, handler)
  return () => bus.off(key, handler)
}
