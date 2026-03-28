import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id as string

  // Fetch initial data server-side — no loading spinner on first render
  const [foldersFlat, { bookmarks, total }] = await Promise.all([
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

  const serializedBookmarks = bookmarks.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }))

  return (
    <DashboardClient
      initialBookmarks={serializedBookmarks}
      initialTotal={total}
      initialFolders={folders}
      user={{ name: session!.user?.name ?? '', image: session!.user?.image ?? null }}
    />
  )
}
