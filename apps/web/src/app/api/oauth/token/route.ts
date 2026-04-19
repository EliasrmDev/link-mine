import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { signExtensionAccessToken } from '@/lib/jwt'
import { OAUTH_CLIENTS, verifyPKCE, REFRESH_TOKEN_LIFETIME_DAYS } from '@/lib/oauth'

const BodySchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  client_id: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
})

/**
 * POST /api/oauth/token
 *
 * OAuth 2.0 Token endpoint.
 * Exchanges an authorization code + PKCE code_verifier for:
 *   - access_token (JWT, 1 hour)
 *   - refresh_token (opaque, 90 days)
 *
 * Security:
 *   - PKCE: SHA-256(code_verifier) must match stored code_challenge
 *   - One-time use: code is marked as used after exchange
 *   - Code TTL: 10 minutes
 *   - Redirect URI must match the one used in /authorize
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

  const { code, redirect_uri, client_id, code_verifier } = parsed.data

  // Validate client
  const client = OAUTH_CLIENTS[client_id]
  if (!client) {
    return NextResponse.json(
      { error: 'unauthorized_client', error_description: 'Unknown client_id' },
      { status: 400 },
    )
  }

  // Look up the authorization code
  const authCode = await prisma.oAuthAuthorizationCode.findUnique({
    where: { code },
    select: {
      id: true,
      userId: true,
      clientId: true,
      redirectUri: true,
      scopes: true,
      codeChallenge: true,
      codeChallengeMethod: true,
      expiresAt: true,
      usedAt: true,
    },
  })

  if (!authCode) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid authorization code' },
      { status: 400 },
    )
  }

  // One-time use
  if (authCode.usedAt) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Authorization code already used' },
      { status: 400 },
    )
  }

  // Mark as used immediately (prevents replay)
  await prisma.oAuthAuthorizationCode.update({
    where: { id: authCode.id },
    data: { usedAt: new Date() },
  })

  // Expired
  if (authCode.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Authorization code expired' },
      { status: 400 },
    )
  }

  // Validate client_id matches
  if (authCode.clientId !== client_id) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Client mismatch' },
      { status: 400 },
    )
  }

  // Validate redirect_uri matches
  if (authCode.redirectUri !== redirect_uri) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Redirect URI mismatch' },
      { status: 400 },
    )
  }

  // PKCE verification
  if (authCode.codeChallengeMethod !== 'S256') {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Unsupported code challenge method' },
      { status: 400 },
    )
  }

  if (!verifyPKCE(code_verifier, authCode.codeChallenge)) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'PKCE verification failed' },
      { status: 400 },
    )
  }

  // Issue tokens
  const refreshTokenExpiresAt = new Date()
  refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + REFRESH_TOKEN_LIFETIME_DAYS)

  const extensionToken = await prisma.extensionToken.create({
    data: {
      userId: authCode.userId,
      scopes: authCode.scopes,
      label: 'Chrome Extension (OAuth)',
      expiresAt: refreshTokenExpiresAt,
      lastUsed: new Date(),
    },
  })

  const { token: accessToken, expiresAt: accessTokenExpiresAt } =
    await signExtensionAccessToken(authCode.userId, authCode.scopes)

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: extensionToken.token,
    scope: authCode.scopes.join(' '),
    // Also include in the format the extension expects for backward compat
    accessToken,
    accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
  })
}
