import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma, setRLSContext } from '@/lib/prisma'
import { signExtensionAccessToken } from '@/lib/jwt'

// Refresh tokens live 90 days — shorter window limits exposure vs the old 365
const REFRESH_TOKEN_LIFETIME_DAYS = 90

// POST /api/extension/connect
// Called by the /extension-auth page after the user is logged in.
// Returns both a long-lived refresh token and an immediate short-lived access token,
// so the extension is ready to make API calls without an extra round-trip.
//
// SECURITY: This endpoint handles sensitive extension tokens and requires RLS context.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // SECURITY: Set RLS context for the authenticated user
  await setRLSContext(session.user.id)

  // Validate that the request comes from our own app using exact origin matching
  if (process.env.NODE_ENV === 'production') {
    const appUrl = process.env.AUTH_URL
    if (!appUrl) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
    let appOrigin: string
    try {
      appOrigin = new URL(appUrl).origin
    } catch {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
    const requestOrigin = request.headers.get('origin') ?? ''
    const referer = request.headers.get('referer') ?? ''
    const refererOrigin = referer ? (() => { try { return new URL(referer).origin } catch { return '' } })() : ''

    // More permissive validation for same-domain requests
    if (requestOrigin !== appOrigin && refererOrigin !== appOrigin) {
      console.warn(`Extension auth origin mismatch. Expected: ${appOrigin}, Got origin: ${requestOrigin}, referer: ${refererOrigin}`)
      // Allow localhost for development testing
      if (!requestOrigin.includes('localhost') && !refererOrigin.includes('localhost')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  const refreshTokenExpiresAt = new Date()
  refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + REFRESH_TOKEN_LIFETIME_DAYS)

  // Upsert: one refresh token per user — reuse valid, replace expired
  // SECURITY: RLS policies ensure user can only access their own tokens
  const existing = await prisma.extensionToken.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  let refreshToken: string
  if (existing && existing.expiresAt > new Date()) {
    // Slide expiry on the existing valid token
    await prisma.extensionToken.update({
      where: { id: existing.id },
      data: { expiresAt: refreshTokenExpiresAt, lastUsed: new Date() },
    })
    refreshToken = existing.token
  } else {
    const created = await prisma.extensionToken.create({
      data: { userId: session.user.id, expiresAt: refreshTokenExpiresAt },
    })
    refreshToken = created.token
  }

  // Issue an immediate access token so the extension doesn't need an extra refresh call
  const { token: accessToken, expiresAt: accessTokenExpiresAt } =
    await signExtensionAccessToken(session.user.id)

  return NextResponse.json({
    // Keep "token" for backward compat with older extension versions
    token: refreshToken,
    refreshToken,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    accessToken,
    accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
  }, {
    headers: {
      'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production'
        ? (process.env.AUTH_URL ?? 'https://linkmine.eliasrm.dev')
        : 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}

// OPTIONS /api/extension/connect — CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production'
        ? (process.env.AUTH_URL ?? 'https://linkmine.eliasrm.dev')
        : 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}

// DELETE /api/extension/connect — revoke all extension tokens for the user
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.extensionToken.deleteMany({ where: { userId: session.user.id } })
  return new NextResponse(null, { status: 204 })
}
