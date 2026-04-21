import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { withRLS } from '@/lib/prisma'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export const metadata: Metadata = { title: 'Dashboard' }

const DASHBOARD_PREF_KEYS = ['dashboard:borders_global', 'dashboard:sidebar_mode', 'dashboard:sort']

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id as string

  // Fetch initial data server-side — no loading spinner on first render
  const { foldersFlat, bookmarks, allPreferences, presets, tagCounts } = await withRLS(userId, async (tx) => {
    const [foldersFlat, bookmarks, allPreferences] = await Promise.all([
      tx.folder.findMany({
        where: { userId },
        include: { _count: { select: { bookmarks: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      tx.bookmark.findMany({
        where: { userId },
        include: { folder: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      tx.userPreference.findMany({
        where: { userId },
        select: { key: true, value: true },
      }),
    ])

    const [presets, tagCounts] = await Promise.all([
      tx.userPreset.findMany({
        where: { userId },
        select: { type: true, value: true },
      }),
      tx.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT unnest("tags") AS name, count(*) AS count
        FROM "public"."Bookmark"
        WHERE "userId" = ${userId}
        GROUP BY name
        ORDER BY count DESC, name ASC
      `.then(rows => rows.map(r => ({ name: r.name, count: Number(r.count) }))),
    ])

    return { foldersFlat, bookmarks, allPreferences, presets, tagCounts }
  })

  // Split preferences into domain-grouping and dashboard config
  const domainPreferencesRaw = allPreferences.filter(p => p.key.startsWith('domain_grouping:'))
  const dashboardPrefsRaw    = allPreferences.filter(p => DASHBOARD_PREF_KEYS.includes(p.key))

  const initialDashboardPrefs: Record<string, string> = {}
  for (const p of dashboardPrefsRaw) initialDashboardPrefs[p.key] = p.value

  // Build tree
  const folders = foldersFlat
    .filter((f) => !f.parentId)
    .map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      children: foldersFlat
        .filter((c) => c.parentId === f.id)
        .map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          children: [],
        })),
    }))

  const serializedBookmarks = bookmarks.map((b) => ({
    ...b,
    icon:         b.icon ?? null,
    folder:       b.folder ?? undefined,
    reminderDate: b.reminderDate ? (b.reminderDate as Date).toISOString() : null,
    lastAccessed: b.lastAccessed ? (b.lastAccessed as Date).toISOString() : null,
    createdAt:    b.createdAt.toISOString(),
    updatedAt:    b.updatedAt.toISOString(),
  }))

  // Process presets and counts for tags and icons
  const tagPresets = presets.filter(p => p.type === 'TAG').map(p => p.value);
  const iconPresets = presets.filter(p => p.type === 'ICON').map(p => p.value);

  const tagCountMap = new Map(tagCounts.map(tc => [tc.name, tc.count]));
  const initialTags = tagPresets.map(tag => ({
    name: tag,
    count: tagCountMap.get(tag) || 0
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const iconCountMap = new Map<string, number>();
  serializedBookmarks.forEach(bookmark => {
    if (bookmark.icon) {
      iconCountMap.set(bookmark.icon, (iconCountMap.get(bookmark.icon) || 0) + 1);
    }
  });

  const initialIcons = iconPresets.map(icon => ({
    icon,
    count: iconCountMap.get(icon) || 0
  })).sort((a, b) => b.count - a.count || a.icon.localeCompare(b.icon));

  // Process domain preferences
  const processedDomainPreferences = domainPreferencesRaw.reduce((acc: Record<string, boolean>, pref) => {
    const domain = pref.key.replace('domain_grouping:', '')
    acc[domain] = pref.value !== 'false'
    return acc
  }, {})

  return (
    <DashboardClient
      initialBookmarks={serializedBookmarks}
      initialFolders={folders}
      initialTagsWithCounts={initialTags}
      initialIconsWithCounts={initialIcons}
      initialDomainPreferences={processedDomainPreferences}
      initialDashboardPrefs={initialDashboardPrefs}
      user={{ name: session!.user?.name ?? '', image: session!.user?.image ?? null }}
    />
  )
}

