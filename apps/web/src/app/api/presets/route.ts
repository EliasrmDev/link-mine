import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLS, type PrismaTx } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'
import { PRESET_TAGS, PRESET_ICONS } from '@linkmine/shared'
import { validateIcon } from '@/lib/icon-validation'

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

async function upsertPresets(tx: PrismaTx, userId: string, type: 'TAG' | 'ICON', values: string[]) {
  await Promise.all(
    values.map((value) => tx.$executeRaw`
      INSERT INTO "public"."UserPreset" ("id", "userId", "type", "value", "createdAt")
      VALUES (${crypto.randomUUID()}, ${userId}, ${type}::"public"."PresetType", ${value}, NOW())
      ON CONFLICT ("userId", "type", "value") DO NOTHING
    `),
  )
}

async function seedDefaultPresetsIfNeeded(tx: PrismaTx, userId: string) {
  const existing = await tx.userPreset.findFirst({ where: { userId, type: 'TAG' } })
  if (existing) return
  await Promise.all([
    upsertPresets(tx, userId, 'TAG', normalizeTags([...PRESET_TAGS])),
    upsertPresets(tx, userId, 'ICON', normalizeIcons([...PRESET_ICONS])),
  ])
}

// GET /api/presets — returns persisted tag and icon presets for the user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  return withRLS(auth.userId, async (tx) => {
    await seedDefaultPresetsIfNeeded(tx, auth.userId)

    const presets = await tx.$queryRaw<PresetRow[]>`
      SELECT "type", "value"
      FROM "public"."UserPreset"
      WHERE "userId" = ${auth.userId}
    `

    const tags = normalizeTags(presets.filter((p: PresetRow) => p.type === 'TAG').map((p: PresetRow) => p.value)).sort()
    const icons = normalizeIcons(presets.filter((p: PresetRow) => p.type === 'ICON').map((p: PresetRow) => p.value))

    return NextResponse.json({ tags, icons }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  })
}

// Tags are short; icons may be URLs (up to 2 048 chars)
const CreateSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TAG'), value: z.string().min(1).max(100) }),
  z.object({ type: z.literal('ICON'), value: z.string().min(1).max(2048) }),
])

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

  // Validate icon format before persisting
  if (type === 'ICON') {
    const iconValidation = validateIcon(value)
    if (!iconValidation.valid) {
      return NextResponse.json({ error: iconValidation.error }, { status: 400 })
    }
  }

  const normalizedValue = type === 'TAG' ? value.toLowerCase().trim() : value.trim()

  return withRLS(auth.userId, async (tx) => {
    try {
      const preset = await tx.userPreset.create({
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
  })
}
