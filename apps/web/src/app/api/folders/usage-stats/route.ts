import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { withRLS } from '@/lib/prisma'

// GET /api/folders/usage-stats
// Returns usage statistics for folders based on bookmark count and access frequency
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  try {
    return await withRLS(auth.userId, async (tx) => {
      const folderStats = await tx.$queryRaw<Array<{
        folderId: string
        bookmarkCount: number
        recentAccesses: number
      }>>`
        SELECT
          "folderId",
          COUNT(*) as "bookmarkCount",
          SUM(CASE WHEN "lastAccessed" > NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) as "recentAccesses"
        FROM "Bookmark"
        WHERE "userId" = ${auth.userId} AND "folderId" IS NOT NULL
        GROUP BY "folderId"
        ORDER BY "bookmarkCount" DESC, "recentAccesses" DESC
      `

      const folderUsage: Record<string, number> = {}
      for (const stat of folderStats) {
        const usageScore = Number(stat.bookmarkCount) + (Number(stat.recentAccesses) * 2)
        folderUsage[stat.folderId] = usageScore
      }

      return NextResponse.json({ folderUsage }, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      })
    })
  } catch (error) {
    console.error('Failed to get folder usage stats:', error)
    return NextResponse.json(
      { error: 'Failed to get folder usage statistics' },
      { status: 500 }
    )
  }
}