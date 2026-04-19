import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { signExtensionAccessToken } from '@/lib/jwt'
import { REFRESH_TOKEN_LIFETIME_DAYS } from '@/lib/oauth'

const BodySchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token is required'),
})

/**
 * POST /api/oauth/refresh
 *
 * OAuth 2.0 Refresh Token endpoint with token rotation.
 * Exchanges an existing refresh token for:
 *   - New access_token (JWT, 1 hour)
 *   - New refresh_token (old one is invalidated)
 *
 * Token rotation: each refresh issues a new refresh token and deletes the old one.
 * This limits the window for stolen token reuse.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: parsed.error.issues[0].message },
      { status: 400 },
    )
  }

  const { refresh_token } = parsed.data

  // Look up existing token
  const existing = await prisma.extensionToken.findUnique({
    where: { token: refresh_token },
    select: { id: true, userId: true, scopes: true, expiresAt: true },
  })

  if (!existing || existing.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Refresh token invalid or expired' },
      { status: 401 },
    )
  }

  // Token rotation: delete old token, create new one
  const refreshTokenExpiresAt = new Date()
  refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + REFRESH_TOKEN_LIFETIME_DAYS)

  const [, newToken] = await prisma.$transaction([
    prisma.extensionToken.delete({ where: { id: existing.id } }),
    prisma.extensionToken.create({
      data: {
        userId: existing.userId,
        scopes: existing.scopes,
        label: 'Chrome Extension (OAuth)',
        expiresAt: refreshTokenExpiresAt,
        lastUsed: new Date(),
      },
    }),
  ])

  // Issue new access token with same scopes
  const scopes = existing.scopes.length > 0 ? existing.scopes : undefined
  const { token: accessToken, expiresAt: accessTokenExpiresAt } =
    await signExtensionAccessToken(existing.userId, scopes)

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: newToken.token,
    scope: existing.scopes.join(' '),
    // Extension-compatible keys
    accessToken,
    accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
  })
}
