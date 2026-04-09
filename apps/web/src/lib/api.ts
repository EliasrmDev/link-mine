import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import { prisma, setRLSContext } from './prisma'
import { isJwt, verifyExtensionAccessToken } from './jwt'

/**
 * Resolves the authenticated user ID from either:
 *   1. A valid NextAuth JWT session (web dashboard)
 *   2. A short-lived extension JWT access token (fast — no DB lookup)
 *   3. A long-lived extension refresh token (DB lookup — backward compat)
 *
 * Returns null if none is present/valid.
 */
export async function resolveUserId(request: NextRequest): Promise<string | null> {
  // 1. Try NextAuth session (web dashboard calls)
  const session = await auth()
  if (session?.user?.id) return session.user.id

  // 2. Try Bearer token
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)

  // 2a. JWT access token — verified locally, no DB hit
  if (isJwt(token)) {
    return await verifyExtensionAccessToken(token)
  }

  // 2b. Opaque refresh token — DB lookup (backward compatibility)
  const extensionToken = await prisma.extensionToken.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  })
  if (extensionToken && extensionToken.expiresAt > new Date()) {
    return extensionToken.userId
  }

  return null
}

/**
 * Enhanced authentication with automatic Row Level Security (RLS) context setup.
 *
 * This function:
 * 1. Resolves the authenticated user ID
 * 2. Sets the RLS context for database operations
 * 3. Returns userId or a 401 JSON response
 *
 * SECURITY: All subsequent database operations in the request will be
 * automatically filtered by RLS policies to only access the user's own data.
 *
 * Usage:
 *   const result = await requireAuth(request)
 *   if ('error' in result) return result.error
 *   const { userId } = result
 *   // All prisma operations are now secured by RLS
 */
export async function requireAuth(
  request: NextRequest,
): Promise<{ userId: string } | { error: NextResponse }> {
  const userId = await resolveUserId(request)
  if (!userId) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // SECURITY: Set RLS context for this user
  // This ensures all subsequent database operations are filtered by user ownership
  try {
    await setRLSContext(userId)
  } catch (error) {
    console.error('Failed to set RLS context:', error)
    return {
      error: NextResponse.json(
        { error: 'Security context setup failed' },
        { status: 500 }
      ),
    }
  }

  return { userId }
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
