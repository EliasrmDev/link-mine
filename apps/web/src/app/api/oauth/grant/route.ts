import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  OAUTH_CLIENTS,
  validateScopes,
  generateAuthorizationCode,
  AUTH_CODE_TTL_MINUTES,
} from '@/lib/oauth'

/**
 * POST /api/oauth/grant
 *
 * Processes the consent form submission.
 * If user authorizes: generates an authorization code and redirects to redirect_uri.
 * If user denies: redirects to redirect_uri with error=access_denied.
 *
 * Called as a form POST from the /oauth/consent page.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const action = formData.get('action') as string | null
  const clientId = formData.get('client_id') as string | null
  const redirectUri = formData.get('redirect_uri') as string | null
  const scope = formData.get('scope') as string | null
  const state = formData.get('state') as string | null
  const codeChallenge = formData.get('code_challenge') as string | null
  const codeChallengeMethod = (formData.get('code_challenge_method') as string | null) ?? 'S256'

  // Validate required params
  if (!clientId || !redirectUri || !scope || !state || !codeChallenge) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      { status: 400 },
    )
  }

  // Validate client
  const client = OAUTH_CLIENTS[clientId]
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Invalid client or redirect_uri' },
      { status: 400 },
    )
  }

  // Validate scopes
  const requestedScopes = scope.split(' ').filter(Boolean)
  if (!validateScopes(requestedScopes)) {
    return NextResponse.json(
      { error: 'invalid_scope', error_description: 'Invalid scopes' },
      { status: 400 },
    )
  }

  const callbackUrl = new URL(redirectUri)

  // User denied
  if (action !== 'authorize') {
    callbackUrl.searchParams.set('error', 'access_denied')
    callbackUrl.searchParams.set('state', state)
    return NextResponse.redirect(callbackUrl, { status: 303 })
  }

  // User authorized — generate authorization code
  const code = generateAuthorizationCode()
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MINUTES * 60 * 1000)

  // Store code in DB (no RLS needed — this is server-side with authenticated session)
  await prisma.oAuthAuthorizationCode.create({
    data: {
      code,
      userId: session.user.id,
      clientId,
      redirectUri,
      scopes: requestedScopes,
      codeChallenge,
      codeChallengeMethod,
      state,
      expiresAt,
    },
  })

  callbackUrl.searchParams.set('code', code)
  callbackUrl.searchParams.set('state', state)

  return NextResponse.redirect(callbackUrl, { status: 303 })
}
