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
    // Aggregate directly in Postgres — no full table scan in Node.js
    const rows = await prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
      SELECT unnest("tags") AS name, count(*) AS count
      FROM "public"."Bookmark"
      WHERE "userId" = ${auth.userId}
      GROUP BY name
      ORDER BY count DESC, name ASC
    `
    const tags = rows.map((r: { name: string; count: bigint }) => ({ name: r.name, count: Number(r.count) }))
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

    return NextResponse.json({ tags: tags.map((t: { value: string }) => t.value).sort() })
  }
}
