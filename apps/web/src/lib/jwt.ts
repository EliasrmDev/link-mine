/**
 * JWT helpers for short-lived extension access tokens.
 *
 * Access tokens are HS256 JWTs signed with AUTH_SECRET, valid for 1 hour.
 * They let the extension make API calls without a DB lookup on every request.
 *
 * Flow:
 *   refreshToken (opaque, 90 days, stored in DB)
 *     → POST /api/extension/refresh
 *     → accessToken (JWT, 1 hour)
 *     → used as Bearer for all API calls
 */

import { SignJWT, jwtVerify } from 'jose'

const ACCESS_TOKEN_LIFETIME_SECONDS = 3600 // 1 hour
const TOKEN_TYPE = 'ext_access'

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

/**
 * Issue a signed JWT access token for an extension user.
 * Returns the token string and its exact expiry date.
 */
export async function signExtensionAccessToken(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + ACCESS_TOKEN_LIFETIME_SECONDS

  const token = await new SignJWT({ type: TOKEN_TYPE })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getSecret())

  return { token, expiresAt: new Date(exp * 1000) }
}

/**
 * Verify an extension access token.
 * Returns the userId if valid, null otherwise (expired, tampered, wrong type).
 */
export async function verifyExtensionAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    if (payload.type !== TOKEN_TYPE) return null
    return payload.sub ?? null
  } catch {
    return null
  }
}

/**
 * Quick heuristic: is this string a JWT (three dot-separated segments)?
 * Used to route validation without trying/catching DB lookups unnecessarily.
 */
export function isJwt(token: string): boolean {
  const parts = token.split('.')
  return parts.length === 3 && parts.every((p) => p.length > 0)
}
