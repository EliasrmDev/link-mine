import { Metadata } from 'next'
import { Suspense } from 'react'
import { OAuthCallbackClient } from './OAuthCallbackClient'

export const metadata: Metadata = { title: 'Connecting Extension…' }

export default function ExtensionAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Loading…</p></div>}>
      <OAuthCallbackClient />
    </Suspense>
  )
}
