'use client'

import { useEffect, useState } from 'react'

// Declare chrome global for TypeScript
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (extensionId: string, message: unknown, callback?: (response: { ok: boolean, error?: string } ) => void) => void
        lastError?: unknown
      }
    }
  }
}

interface Props {
  extensionId: string | null
  isValidId: boolean
  validationError?: string
  userName: string
}

export function ExtensionAuthClient({ extensionId, isValidId, validationError = '', userName }: Props) {
  const [status, setStatus] = useState<'connecting' | 'success' | 'error'>('connecting')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!isValidId) {
      setStatus('error')
      setErrorMessage(validationError || 'Invalid extension ID.')
      return
    }

    async function connect() {
      try {
        console.log('Starting extension connection process...')

        // 1. Get tokens from our API (returns refresh + access token)
        const res = await fetch('/api/extension/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin'
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
          console.error('API request failed:', res.status, errorData)
          throw new Error(errorData.error || `API request failed: ${res.status}`)
        }

        const data = await res.json()
        console.log('Tokens received:', { hasToken: !!data.token, hasAccessToken: !!data.accessToken })

        // 2. Send tokens to extension via chrome.runtime.sendMessage
        //    We forward both the refresh token and the pre-issued access token
        //    so the extension is immediately ready without a second round-trip.
        if (extensionId && typeof window !== 'undefined' && window.chrome?.runtime) {
          console.log('Sending message to extension:', extensionId)

          window.chrome.runtime.sendMessage(
            extensionId,
            {
              type: 'LINKMINE_AUTH_TOKEN',
              token: data.token, // backward compat
              accessToken: data.accessToken,
              accessTokenExpiresAt: data.accessTokenExpiresAt,
            },
            (response) => {
              if (window.chrome?.runtime?.lastError) {
                console.warn('Extension message failed:', window.chrome.runtime.lastError)
                setStatus('error')
                setErrorMessage('Extension is not responding. Make sure it\'s installed and enabled.')
                return
              }
              console.log('Extension responded:', response)
            },
          )
        } else {
          console.warn('Chrome runtime not available or no extension ID')
          setStatus('error')
          setErrorMessage('Chrome extension API not available. This only works in Chrome browser.')
          return
        }

        setStatus('success')

        // Close this tab after a short delay
        setTimeout(() => {
          window.close()
        }, 2500)
      } catch (err) {
        console.error('Connection error:', err)
        setStatus('error')
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Could not connect to the extension. Please try again.'
        )
      }
    }

    connect()
  }, [extensionId, isValidId, validationError])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="card max-w-sm w-full p-8 text-center">
        <span className="text-2xl font-bold text-brand-400">LinkMine</span>

        {status === 'connecting' && (
          <>
            <div className="mt-6 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-label="Loading" />
            </div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Connecting extension…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mt-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" aria-hidden="true">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="mt-4 font-semibold text-gray-900 dark:text-white">
              Connected, {userName}!
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Your extension is now linked. This tab will close automatically.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mt-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" aria-hidden="true">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <p className="mt-4 font-semibold text-red-700 dark:text-red-400">Connection failed</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary mt-4 w-full"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  )
}
