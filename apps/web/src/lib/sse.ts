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

const bus = new EventEmitter()
bus.setMaxListeners(2000) // allow many concurrent connections

// ─── Event shapes ─────────────────────────────────────────────────────────────

export type SyncEvent =
  | { type: 'bookmark:saved';   bookmark: Record<string, unknown> }
  | { type: 'bookmark:deleted'; id: string }
  | { type: 'folders:changed' }

// ─── Broadcast ───────────────────────────────────────────────────────────────

export function broadcastToUser(userId: string, event: SyncEvent): void {
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
