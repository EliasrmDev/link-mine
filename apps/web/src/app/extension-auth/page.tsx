import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ExtensionAuthClient } from './ExtensionAuthClient'

export const metadata: Metadata = { title: 'Connecting Extension…' }

export default async function ExtensionAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ extensionId?: string }>
}) {
  const session = await auth()
  const { extensionId } = await searchParams

  if (!session) {
    redirect(`/login?from=extension&callbackUrl=/extension-auth${extensionId ? `?extensionId=${extensionId}` : ''}`)
  }

  // Allow any valid Chrome extension ID format (32 lowercase alphanumeric characters)
  let isValidId = false
  let validationError = ''

  if (!extensionId) {
    isValidId = false
    validationError = 'No extension ID provided'
  } else if (!/^[a-z]{32}$/.test(extensionId)) {
    isValidId = false
    validationError = 'Invalid extension ID format. Chrome extension IDs should be 32 lowercase letters.'
  } else {
    isValidId = true
  }

  return (
    <ExtensionAuthClient
      extensionId={extensionId ?? null}
      isValidId={isValidId}
      validationError={validationError}
      userName={session.user?.name ?? 'there'}
    />
  )
}
