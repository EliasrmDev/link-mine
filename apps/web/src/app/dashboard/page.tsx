import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id as string

  // Fetch initial data server-side — no loading spinner on first render
  const [foldersFlat, { bookmarks, total }, presets, tagCounts] = await Promise.all([
    prisma.folder.findMany({
      where: { userId },
      include: { _count: { select: { bookmarks: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.bookmark
      .findMany({
        where: { userId },
        include: { folder: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      .then((bookmarks) =>
        prisma.bookmark.count({ where: { userId } }).then((total) => ({ bookmarks, total })),
      ),
    // Get presets for tags and icons
    prisma.userPreset.findMany({
      where: { userId },
      select: { type: true, value: true },
    }),
    // Get tag usage counts
    prisma.bookmark.findMany({
      where: { userId },
      select: { tags: true },
    }).then(bookmarks => {
      const tagCounts = new Map<string, number>();
      bookmarks.forEach(bookmark => {
        bookmark.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });
      return Array.from(tagCounts.entries()).map(([name, count]) => ({ name, count }));
    }),
  ])

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serializedBookmarks = (bookmarks as any[]).map((b) => ({
    ...b,
    icon:         b.icon ?? null,
    reminderDate: b.reminderDate ? (b.reminderDate as Date).toISOString() : null,
    lastAccessed: b.lastAccessed ? (b.lastAccessed as Date).toISOString() : null,
    createdAt:    b.createdAt.toISOString(),
    updatedAt:    b.updatedAt.toISOString(),
  }))

  // Process presets and counts for tags and icons
  const tagPresets = presets.filter(p => p.type === 'TAG').map(p => p.value);
  const iconPresets = presets.filter(p => p.type === 'ICON').map(p => p.value);

  // Create tag count map and combine with presets
  const tagCountMap = new Map(tagCounts.map(tc => [tc.name, tc.count]));
  const initialTags = tagPresets.map(tag => ({
    name: tag,
    count: tagCountMap.get(tag) || 0
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // Create icon counts from current bookmark data
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

  return (
    <DashboardClient
      initialBookmarks={serializedBookmarks}
      initialTotal={total}
      initialFolders={folders}
      initialTagsWithCounts={initialTags}
      initialIconsWithCounts={initialIcons}
      user={{ name: session!.user?.name ?? '', image: session!.user?.image ?? null }}
    />
  )
}
