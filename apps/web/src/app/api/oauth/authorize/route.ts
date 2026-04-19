import { NextRequest, NextResponse } from 'next/server'
import { OAUTH_CLIENTS, VALID_SCOPES, validateScopes } from '@/lib/oauth'

/**
 * GET /api/oauth/authorize
 *
 * OAuth 2.0 Authorization endpoint.
 * Validates all PKCE parameters, then redirects to the consent page.
 *
 * Required query params:
 *   client_id, redirect_uri, response_type=code, scope, state,
 *   code_challenge, code_challenge_method=S256
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const clientId = params.get('client_id')
  const redirectUri = params.get('redirect_uri')
  const responseType = params.get('response_type')
  const scope = params.get('scope')
  const state = params.get('state')
  const codeChallenge = params.get('code_challenge')
  const codeChallengeMethod = params.get('code_challenge_method')

  // ─── Validate required params ─────────────────────────────────────────────

  if (!clientId || !redirectUri || !responseType || !scope || !state || !codeChallenge) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      { status: 400 },
    )
  }

  // ─── Validate response_type ───────────────────────────────────────────────

  if (responseType !== 'code') {
    return NextResponse.json(
      { error: 'unsupported_response_type', error_description: 'Only response_type=code is supported' },
      { status: 400 },
    )
  }

  // ─── Validate code_challenge_method ───────────────────────────────────────

  if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Only code_challenge_method=S256 is supported' },
      { status: 400 },
    )
  }

  // ─── Validate client_id ───────────────────────────────────────────────────

  const client = OAUTH_CLIENTS[clientId]
  if (!client) {
    return NextResponse.json(
      { error: 'unauthorized_client', error_description: 'Unknown client_id' },
      { status: 400 },
    )
  }

  // ─── Validate redirect_uri (strict allowlist) ─────────────────────────────

  if (!client.redirectUris.includes(redirectUri)) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Invalid redirect_uri' },
      { status: 400 },
    )
  }

  // ─── Validate scopes ─────────────────────────────────────────────────────

  const requestedScopes = scope.split(' ').filter(Boolean)
  if (requestedScopes.length === 0) {
    return NextResponse.json(
      { error: 'invalid_scope', error_description: 'At least one scope is required' },
      { status: 400 },
    )
  }

  if (!validateScopes(requestedScopes)) {
    return NextResponse.json(
      {
        error: 'invalid_scope',
        error_description: `Invalid scope. Valid scopes: ${VALID_SCOPES.join(', ')}`,
      },
      { status: 400 },
    )
  }

  // ─── Validate code_challenge format (base64url, 43-128 chars) ─────────────

  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Invalid code_challenge format' },
      { status: 400 },
    )
  }

  // ─── Redirect to consent page with all params ─────────────────────────────

  const consentUrl = new URL('/oauth/consent', request.url)
  consentUrl.searchParams.set('client_id', clientId)
  consentUrl.searchParams.set('redirect_uri', redirectUri)
  consentUrl.searchParams.set('scope', scope)
  consentUrl.searchParams.set('state', state)
  consentUrl.searchParams.set('code_challenge', codeChallenge)
  consentUrl.searchParams.set('code_challenge_method', codeChallengeMethod ?? 'S256')

  return NextResponse.redirect(consentUrl)
}
