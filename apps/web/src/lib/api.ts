import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import { prisma } from './prisma'
import { isJwt, verifyExtensionAccessToken } from './jwt'

interface AuthResult {
  userId: string
  /** null = full access (session or pre-OAuth tokens); string[] = scoped (OAuth tokens) */
  scopes: string[] | null
}

/**
 * Resolves the authenticated user ID from either:
 *   1. A valid NextAuth JWT session (web dashboard) — full access
 *   2. A short-lived extension JWT access token (fast — no DB lookup)
 *   3. A long-lived extension refresh token (DB lookup — backward compat)
 *
 * Returns null if none is present/valid.
 */
export async function resolveUserId(request: NextRequest): Promise<AuthResult | null> {
  // 1. Try NextAuth session (web dashboard calls) — full access
  const session = await auth()
  if (session?.user?.id) return { userId: session.user.id, scopes: null }

  // 2. Try Bearer token
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)

  // 2a. JWT access token — verified locally, no DB hit
  if (isJwt(token)) {
    const result = await verifyExtensionAccessToken(token)
    if (!result) return null
    return { userId: result.userId, scopes: result.scopes }
  }

  // 2b. Opaque refresh token — DB lookup (backward compatibility) — full access
  const extensionToken = await prisma.extensionToken.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  })
  if (extensionToken && extensionToken.expiresAt > new Date()) {
    return { userId: extensionToken.userId, scopes: null }
  }

  return null
}

/**
 * Authenticate the request and return the userId and scopes.
 *
 * RLS context is NOT set here — callers must wrap their DB operations
 * in `withRLS(userId, ...)` from `@/lib/prisma` to ensure proper
 * transaction-scoped RLS with SET LOCAL (PgBouncer-safe).
 *
 * Usage:
 *   const result = await requireAuth(request)
 *   if ('error' in result) return result.error
 *   return withRLS(result.userId, async (tx) => { ... })
 */
export async function requireAuth(
  request: NextRequest,
): Promise<{ userId: string; scopes: string[] | null } | { error: NextResponse }> {
  const resolved = await resolveUserId(request)
  if (!resolved) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { userId: resolved.userId, scopes: resolved.scopes }
}

/**
 * Check if a token's scopes include all required scopes.
 * Returns null if allowed, or a 403 NextResponse if insufficient.
 *
 * scopes=null means full access (session or pre-OAuth token) — always allowed.
 */
export function requireScopes(
  scopes: string[] | null,
  ...required: string[]
): NextResponse | null {
  // null scopes = full access (backward compat)
  if (scopes === null) return null
  const missing = required.filter((r) => !scopes.includes(r))
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'insufficient_scope', required: missing },
      { status: 403 },
    )
  }
  return null
}

/** Standard 400 response */
export const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 })

/** Standard 404 response */
export const notFound = (resource = 'Resource') =>
  NextResponse.json({ error: `${resource} not found` }, { status: 404 })

/** Standard 403 response */
export const forbidden = () =>
  NextResponse.json({ error: 'Forbidden' }, { status: 403 })

/** Deduplicate and lowercase tags. Shared by bookmark create/update routes. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const raw of tags) {
    const value = raw.trim().toLowerCase()
    if (!value || seen.has(value)) continue
    seen.add(value)
    normalized.push(value)
  }
  return normalized
}
