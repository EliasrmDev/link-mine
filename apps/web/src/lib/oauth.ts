/**
 * OAuth 2.0 configuration for the Chrome extension PKCE flow.
 *
 * Centralizes client IDs, redirect URIs, scopes, and validation helpers
 * shared across /api/oauth/* routes.
 */

import crypto from 'crypto'

// ─── Valid scopes ─────────────────────────────────────────────────────────────

export const VALID_SCOPES = [
  'bookmark:read',
  'bookmark:write',
  'folder:read',
  'folder:write',
] as const

export type OAuthScope = (typeof VALID_SCOPES)[number]

// ─── Client allowlist ─────────────────────────────────────────────────────────

/**
 * Allowed OAuth clients. For now, only the Chrome extension.
 * Each client has an ID and a strict set of allowed redirect URIs.
 */
export const OAUTH_CLIENTS: Record<string, { name: string; redirectUris: string[] }> = {
  'chrome-extension': {
    name: 'LinkMine Chrome Extension',
    redirectUris: [
      // The extension receives the code via the web app callback page
      `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000'}/extension-auth/callback`,
    ],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Validate that all requested scopes are in the allowed set */
export function validateScopes(scopes: string[]): scopes is OAuthScope[] {
  return scopes.every((s) => (VALID_SCOPES as readonly string[]).includes(s))
}

/** Generate a cryptographically random authorization code (URL-safe base64, 32 bytes) */
export function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/** PKCE: verify code_verifier against code_challenge (S256) */
export function verifyPKCE(codeVerifier: string, codeChallenge: string): boolean {
  const expected = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  return expected === codeChallenge
}

/** Authorization code TTL in minutes */
export const AUTH_CODE_TTL_MINUTES = 10

/** Refresh token lifetime in days */
export const REFRESH_TOKEN_LIFETIME_DAYS = 90
