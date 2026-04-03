import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'
import { PRESET_TAGS, PRESET_ICONS } from '@linkmine/shared'

type PresetRow = { type: 'TAG' | 'ICON'; value: string }

function normalizeTags(values: string[]): string[] {
  const set = new Set<string>()
  for (const value of values) {
    const tag = value.trim().toLowerCase()
    if (tag) set.add(tag)
  }
  return Array.from(set)
}

function normalizeIcons(values: string[]): string[] {
  const set = new Set<string>()
  for (const value of values) {
    const icon = value.trim()
    if (icon) set.add(icon)
  }
  return Array.from(set)
}

async function upsertPresets(userId: string, type: 'TAG' | 'ICON', values: string[]) {
  // Batch all inserts in parallel instead of sequential loop
  await Promise.all(
    values.map((value) => prisma.$executeRaw`
      INSERT INTO "public"."UserPreset" ("id", "userId", "type", "value", "createdAt")
      VALUES (${crypto.randomUUID()}, ${userId}, ${type}::"public"."PresetType", ${value}, NOW())
      ON CONFLICT ("userId", "type", "value") DO NOTHING
    `),
  )
}

/**
 * Seed default presets for a new user (called once after sign-in, not on every GET).
 * Only writes if the user has zero TAG presets — avoids repeated writes on every read.
 */
async function seedDefaultPresetsIfNeeded(userId: string) {
  const existing = await prisma.userPreset.findFirst({ where: { userId, type: 'TAG' } })
  if (existing) return
  await Promise.all([
    upsertPresets(userId, 'TAG', normalizeTags([...PRESET_TAGS])),
    upsertPresets(userId, 'ICON', normalizeIcons([...PRESET_ICONS])),
  ])
}

// GET /api/presets — returns persisted tag and icon presets for the user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  // Seed defaults once for new users (no-op after first call)
  await seedDefaultPresetsIfNeeded(auth.userId)

  const presets = await prisma.$queryRaw<PresetRow[]>`
    SELECT "type", "value"
    FROM "public"."UserPreset"
    WHERE "userId" = ${auth.userId}
  `

  const tags = normalizeTags(presets.filter((p: PresetRow) => p.type === 'TAG').map((p: PresetRow) => p.value)).sort()
  const icons = normalizeIcons(presets.filter((p: PresetRow) => p.type === 'ICON').map((p: PresetRow) => p.value))

  return NextResponse.json({ tags, icons })
}

const CreateSchema = z.object({
  type: z.enum(['TAG', 'ICON']),
  value: z.string().min(1).max(50),
})

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { type, value } = parsed.data
  const normalizedValue = type === 'TAG' ? value.toLowerCase().trim() : value.trim()

  try {
    const preset = await prisma.userPreset.create({
      data: { userId: auth.userId, type, value: normalizedValue },
    })
    return NextResponse.json({ success: true, preset }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Preset already exists' }, { status: 409 })
    }
    console.error('Error creating preset:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
