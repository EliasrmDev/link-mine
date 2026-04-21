import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLS } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'

// Whitelist of keys managed via this endpoint
const DASHBOARD_PREF_KEYS = ['dashboard:borders_global', 'dashboard:sidebar_mode', 'dashboard:sort'] as const
type DashboardPrefKey = (typeof DASHBOARD_PREF_KEYS)[number]

function isAllowedKey(key: string): key is DashboardPrefKey {
  return (DASHBOARD_PREF_KEYS as readonly string[]).includes(key)
}

// GET /api/preferences — returns current dashboard preferences for the user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error
  const { userId } = auth

  const rows = await withRLS(userId, (tx) =>
    tx.userPreference.findMany({
      where: { userId, key: { in: [...DASHBOARD_PREF_KEYS] } },
      select: { key: true, value: true },
    }),
  )

  const result: Record<string, string> = {}
  for (const row of rows) result[row.key] = row.value
  return NextResponse.json(result)
}

const PatchSchema = z.record(z.string().max(255), z.string().max(500))

// PATCH /api/preferences — upsert one or more dashboard preferences
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error
  const { userId } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON')
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return badRequest('Invalid body')

  const updates = Object.entries(parsed.data).filter(([k]) => isAllowedKey(k))
  if (updates.length === 0) return badRequest('No valid preference keys')

  await withRLS(userId, async (tx) => {
    await Promise.all(
      updates.map(([key, value]) =>
        tx.$executeRaw`
          INSERT INTO "public"."UserPreference" ("id", "userId", "key", "value", "createdAt", "updatedAt")
          VALUES (${crypto.randomUUID()}, ${userId}, ${key}, ${value}, NOW(), NOW())
          ON CONFLICT ("userId", "key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()
        `,
      ),
    )
  })

  return new NextResponse(null, { status: 204 })
}
