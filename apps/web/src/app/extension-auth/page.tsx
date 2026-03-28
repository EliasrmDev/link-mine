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

  const allowedIds = (process.env.ALLOWED_EXTENSION_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  // In development, skip extension ID validation
  const isValidId =
    process.env.NODE_ENV !== 'production' ||
    !extensionId ||
    allowedIds.includes(extensionId)

  return (
    <ExtensionAuthClient
      extensionId={extensionId ?? null}
      isValidId={isValidId}
      userName={session.user?.name ?? 'there'}
    />
  )
}
