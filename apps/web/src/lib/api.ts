import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import { prisma } from './prisma'

/**
 * Resolves the authenticated user ID from either:
 *   1. A valid NextAuth JWT session (web dashboard)
 *   2. A valid extension Bearer token (Chrome extension)
 *
 * Returns null if neither is present/valid.
 */
export async function resolveUserId(request: NextRequest): Promise<string | null> {
  // 1. Try NextAuth session (web dashboard calls)
  const session = await auth()
  if (session?.user?.id) return session.user.id

  // 2. Try extension Bearer token
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const extensionToken = await prisma.extensionToken.findUnique({
      where: { token },
      select: { userId: true, expiresAt: true },
    })
    if (extensionToken && extensionToken.expiresAt > new Date()) {
      return extensionToken.userId
    }
  }

  return null
}

/**
 * Convenience: returns userId or a 401 JSON response.
 * Usage:
 *   const result = await requireAuth(request)
 *   if ('error' in result) return result.error
 *   const { userId } = result
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
