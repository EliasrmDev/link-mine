import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const BodySchema = z.object({
  token: z.string().min(1, 'token is required'),
})

/**
 * POST /api/oauth/revoke
 *
 * OAuth 2.0 Token Revocation (RFC 7009).
 * Accepts a refresh token and deletes it from the database.
 * Always returns 200 per spec (even if token doesn't exist).
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

  // Delete the token (ignore if not found — per RFC 7009)
  await prisma.extensionToken.deleteMany({
    where: { token: parsed.data.token },
  })

  return new NextResponse(null, { status: 200 })
}
