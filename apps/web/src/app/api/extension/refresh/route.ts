import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { signExtensionAccessToken } from '@/lib/jwt'

const BodySchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
})

/**
 * POST /api/extension/refresh
 *
 * Exchange a long-lived refresh token for a short-lived JWT access token.
 * The access token (1 hour) is used as the Bearer token for all subsequent
 * API calls — validated locally via JWT signature, no DB lookup.
 *
 * This endpoint is the ONLY place the refresh token is presented to the server.
 * All other API routes only see short-lived access tokens.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { refreshToken } = parsed.data

  // Validate refresh token (single DB lookup)
  const record = await prisma.extensionToken.findUnique({
    where: { token: refreshToken },
    select: { id: true, userId: true, expiresAt: true },
  })

  if (!record || record.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: 'Refresh token invalid or expired. Please sign in again.' },
      { status: 401 },
    )
  }

  // Update lastUsed for audit trail (non-blocking: don't await)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.extensionToken.update({ where: { id: record.id }, data: { lastUsed: new Date() } as any })
    .catch(() => { /* non-critical */ })

  // Issue a fresh JWT access token
  const { token: accessToken, expiresAt } = await signExtensionAccessToken(record.userId)

  return NextResponse.json({
    accessToken,
    expiresAt: expiresAt.toISOString(),
  })
}
