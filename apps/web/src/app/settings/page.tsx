import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { withRLS } from '@/lib/prisma'
import { SettingsClient } from '@/components/settings/SettingsClient'

export const metadata: Metadata = { title: 'Settings — LinkMine' }

export default async function SettingsPage() {
  const session = await auth()
  const userId = session!.user!.id as string

  // Fetch the OAuth provider linked to this account (first linked account wins)
  const { provider } = await withRLS(userId, async (tx) => {
    const account = await tx.account.findFirst({
      where: { userId },
      select: { provider: true },
    })
    return { provider: account?.provider ?? null }
  })

  const user = session!.user!

  return (
    <SettingsClient
      user={{
        id: userId,
        name: user.name ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
        provider,
      }}
    />
  )
}
