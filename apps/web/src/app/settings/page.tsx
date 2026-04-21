import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { withRLS } from '@/lib/prisma'
import { SettingsClient } from '@/components/settings/SettingsClient'

export const metadata: Metadata = { title: 'Settings — LinkMine' }

const DASHBOARD_PREF_KEYS = ['dashboard:borders_global', 'dashboard:sidebar_mode', 'dashboard:sort']

export default async function SettingsPage() {
  const session = await auth()
  const userId = session!.user!.id as string

  const { provider, dashboardPrefs } = await withRLS(userId, async (tx) => {
    const [account, rawPrefs] = await Promise.all([
      tx.account.findFirst({
        where: { userId },
        select: { provider: true },
      }),
      tx.userPreference.findMany({
        where: { userId, key: { in: DASHBOARD_PREF_KEYS } },
        select: { key: true, value: true },
      }),
    ])

    const dashboardPrefs: Record<string, string> = {}
    for (const p of rawPrefs) dashboardPrefs[p.key] = p.value

    return { provider: account?.provider ?? null, dashboardPrefs }
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
      initialPrefs={dashboardPrefs}
    />
  )
}

