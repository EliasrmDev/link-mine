import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { OAUTH_CLIENTS, validateScopes } from '@/lib/oauth'
import { ConsentForm } from './ConsentForm'

export const metadata: Metadata = { title: 'Authorize Application' }

const SCOPE_LABELS: Record<string, { label: string; description: string }> = {
  'bookmark:read': { label: 'Read bookmarks', description: 'View your saved bookmarks' },
  'bookmark:write': { label: 'Manage bookmarks', description: 'Create, edit, and delete bookmarks' },
  'folder:read': { label: 'Read folders', description: 'View your folder structure' },
  'folder:write': { label: 'Manage folders', description: 'Create, edit, and delete folders' },
}

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{
    client_id?: string
    redirect_uri?: string
    scope?: string
    state?: string
    code_challenge?: string
    code_challenge_method?: string
  }>
}) {
  const session = await auth()
  const params = await searchParams

  const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = params

  // Not authenticated → redirect to login with callback back here
  if (!session?.user?.id) {
    const currentUrl = new URL('/oauth/consent', process.env.AUTH_URL ?? 'http://localhost:3000')
    if (client_id) currentUrl.searchParams.set('client_id', client_id)
    if (redirect_uri) currentUrl.searchParams.set('redirect_uri', redirect_uri)
    if (scope) currentUrl.searchParams.set('scope', scope)
    if (state) currentUrl.searchParams.set('state', state)
    if (code_challenge) currentUrl.searchParams.set('code_challenge', code_challenge)
    if (code_challenge_method) currentUrl.searchParams.set('code_challenge_method', code_challenge_method)

    redirect(`/login?callbackUrl=${encodeURIComponent(currentUrl.pathname + currentUrl.search)}`)
  }

  // Validate params (they were already validated in /api/oauth/authorize, but re-check)
  if (!client_id || !redirect_uri || !scope || !state || !code_challenge) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
        <div className="card max-w-sm w-full p-8 text-center">
          <span className="text-2xl font-bold text-brand-400">LinkMine</span>
          <p className="mt-4 text-red-600 dark:text-red-400">Invalid authorization request. Missing required parameters.</p>
        </div>
      </div>
    )
  }

  const client = OAUTH_CLIENTS[client_id]
  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
        <div className="card max-w-sm w-full p-8 text-center">
          <span className="text-2xl font-bold text-brand-400">LinkMine</span>
          <p className="mt-4 text-red-600 dark:text-red-400">Unknown application.</p>
        </div>
      </div>
    )
  }

  const requestedScopes = scope.split(' ').filter(Boolean)
  if (!validateScopes(requestedScopes)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
        <div className="card max-w-sm w-full p-8 text-center">
          <span className="text-2xl font-bold text-brand-400">LinkMine</span>
          <p className="mt-4 text-red-600 dark:text-red-400">Invalid scopes requested.</p>
        </div>
      </div>
    )
  }

  const scopeInfo = requestedScopes.map((s) => SCOPE_LABELS[s] ?? { label: s, description: '' })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="card max-w-sm w-full p-8">
        <div className="text-center">
          <span className="text-2xl font-bold text-brand-400">LinkMine</span>
          <h1 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            Authorize {client.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            signed in as {session.user.name ?? session.user.email}
          </p>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            This application wants to:
          </p>
          <ul className="mt-3 space-y-2">
            {scopeInfo.map((s) => (
              <li key={s.label} className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{s.label}</span>
                  {s.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ConsentForm
          clientId={client_id}
          redirectUri={redirect_uri}
          scope={scope}
          state={state}
          codeChallenge={code_challenge}
          codeChallengeMethod={code_challenge_method ?? 'S256'}
        />
      </div>
    </div>
  )
}
