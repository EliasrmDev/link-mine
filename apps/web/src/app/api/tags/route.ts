import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

// GET /api/tags — returns unique lowercase tags used by the user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const tags = await prisma.$queryRaw<Array<{ value: string }>>`
    SELECT "value"
    FROM "public"."UserPreset"
    WHERE "userId" = ${auth.userId}
      AND "type" = 'TAG'::"public"."PresetType"
    ORDER BY "value" ASC
  `

  return NextResponse.json({ tags: tags.map((t) => t.value).sort() })
}
