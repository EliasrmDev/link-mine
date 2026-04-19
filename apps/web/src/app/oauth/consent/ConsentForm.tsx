'use client'

import { useState } from 'react'

interface Props {
  clientId: string
  redirectUri: string
  scope: string
  state: string
  codeChallenge: string
  codeChallengeMethod: string
}

export function ConsentForm({ clientId, redirectUri, scope, state, codeChallenge, codeChallengeMethod }: Props) {
  const [submitting, setSubmitting] = useState(false)

  return (
    <form action="/api/oauth/grant" method="POST" className="mt-6 space-y-3">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="state" value={state} />
      <input type="hidden" name="code_challenge" value={codeChallenge} />
      <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />

      <button
        type="submit"
        name="action"
        value="authorize"
        disabled={submitting}
        onClick={() => setSubmitting(true)}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-900"
      >
        {submitting ? 'Authorizing…' : 'Authorize'}
      </button>

      <button
        type="submit"
        name="action"
        value="deny"
        disabled={submitting}
        onClick={() => setSubmitting(true)}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-900"
      >
        Cancel
      </button>
    </form>
  )
}
