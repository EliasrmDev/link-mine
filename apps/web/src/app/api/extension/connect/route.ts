import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { signExtensionAccessToken } from '@/lib/jwt'

// Refresh tokens live 90 days — shorter window limits exposure vs the old 365
const REFRESH_TOKEN_LIFETIME_DAYS = 90

// POST /api/extension/connect
// Called by the /extension-auth page after the user is logged in.
// Returns both a long-lived refresh token and an immediate short-lived access token,
// so the extension is ready to make API calls without an extra round-trip.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate that the request comes from our own app using exact origin matching
  if (process.env.NODE_ENV === 'production') {
    const appUrl = process.env.AUTH_URL ?? ''
    let appOrigin: string
    try {
      appOrigin = new URL(appUrl).origin
    } catch {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
    const requestOrigin = request.headers.get('origin') ?? ''
    const referer = request.headers.get('referer') ?? ''
    const refererOrigin = referer ? (() => { try { return new URL(referer).origin } catch { return '' } })() : ''
    if (requestOrigin !== appOrigin && refererOrigin !== appOrigin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const refreshTokenExpiresAt = new Date()
  refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + REFRESH_TOKEN_LIFETIME_DAYS)

  // Upsert: one refresh token per user — reuse valid, replace expired
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
