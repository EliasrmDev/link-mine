'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, X } from 'lucide-react'

/**
 * Receives the authorization code from the OAuth flow, exchanges it for tokens
 * via POST /api/oauth/token, then sends them to the extension.
 *
 * URL: /extension-auth/callback?code=...&state=...
 *
 * The state parameter contains JSON: { extensionId, codeVerifier }
 * encoded as base64url so it survives the redirect.
 */
export function OAuthCallbackClient() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'exchanging' | 'success' | 'error'>('exchanging')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const stateParam = searchParams.get('state')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setStatus('error')
      setErrorMessage(
        errorParam === 'access_denied'
          ? 'Authorization was denied.'
          : `Authorization failed: ${errorParam}`,
      )
      return
    }

    if (!code || !stateParam) {
      setStatus('error')
      setErrorMessage('Missing authorization code or state.')
      return
    }

    // Decode state
    let state: { extensionId: string; codeVerifier: string; redirectUri: string }
    try {
      state = JSON.parse(atob(stateParam.replace(/-/g, '+').replace(/_/g, '/')))
    } catch {
      setStatus('error')
      setErrorMessage('Invalid state parameter.')
      return
    }

    async function exchangeCode() {
      try {
        // Exchange code for tokens
        const res = await fetch('/api/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: state.redirectUri,
            client_id: 'chrome-extension',
            code_verifier: state.codeVerifier,
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error_description: 'Token exchange failed' }))
          throw new Error(data.error_description || 'Token exchange failed')
        }

        const tokens = await res.json()

        // Send tokens to extension
        if (typeof window !== 'undefined' && window.chrome?.runtime) {
          window.chrome.runtime.sendMessage(
            state.extensionId,
            {
              type: 'LINKMINE_AUTH_TOKEN',
              token: tokens.refresh_token,
              accessToken: tokens.access_token,
              accessTokenExpiresAt: tokens.accessTokenExpiresAt,
            },
            (response) => {
              if (window.chrome?.runtime?.lastError) {
                console.warn('Extension message failed:', window.chrome.runtime.lastError)
                setStatus('error')
                setErrorMessage("Extension isn't responding. Make sure it's installed and enabled.")
                return
              }
              console.log('Extension responded:', response)
            },
          )
        } else {
          setStatus('error')
          setErrorMessage('Chrome extension API not available.')
          return
        }

        setStatus('success')
        setTimeout(() => window.close(), 2500)
      } catch (err) {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Authorization failed.')
      }
    }

    exchangeCode()
  }, [searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="card max-w-sm w-full p-8 text-center">
        <span className="text-2xl font-bold text-brand-400">LinkMine</span>

        {status === 'exchanging' && (
          <>
            <div className="mt-6 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-label="Loading" />
            </div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Completing authorization…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mt-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" aria-hidden="true">
                <Check className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-4 font-semibold text-gray-900 dark:text-white">Connected!</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Your extension is now linked. This tab will close automatically.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mt-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" aria-hidden="true">
                <X className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-4 font-semibold text-red-700 dark:text-red-400">Authorization failed</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{errorMessage}</p>
          </>
        )}
      </div>
    </div>
  )
}

// Declare chrome global for TypeScript
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (extensionId: string, message: unknown, callback?: (response: { ok: boolean; error?: string }) => void) => void
        lastError?: unknown
      }
    }
  }
}
