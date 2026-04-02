import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

// GET /api/tags — returns unique lowercase tags used by the user with counts
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const url = new URL(request.url)
  const withCounts = url.searchParams.get('counts') === 'true'

  if (withCounts) {
    // Get all bookmarks to count tags
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: auth.userId },
      select: { tags: true },
    })

    // Count occurrences of each tag
    const tagCounts = new Map<string, number>()

    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })

    // Convert to array and sort by count (descending) then by name
    const tags = Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

    return NextResponse.json(tags)
  } else {
    // Original behavior - just return tag names from presets
    const tags = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT "value"
      FROM "public"."UserPreset"
      WHERE "userId" = ${auth.userId}
        AND "type" = 'TAG'::"public"."PresetType"
      ORDER BY "value" ASC
    `

    return NextResponse.json({ tags: tags.map((t) => t.value).sort() })
  }
}
