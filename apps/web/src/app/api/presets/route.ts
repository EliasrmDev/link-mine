import { NextRequest, NextResponse } from 'next/server'
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
  for (const value of values) {
    await prisma.$executeRaw`
      INSERT INTO "public"."UserPreset" ("id", "userId", "type", "value", "createdAt")
      VALUES (${crypto.randomUUID()}, ${userId}, ${type}::"public"."PresetType", ${value}, NOW())
      ON CONFLICT ("userId", "type", "value") DO NOTHING
    `
  }
}

// GET /api/presets — canonical persistent presets for tags and icons
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: auth.userId },
    select: { tags: true, icon: true },
  })

  const bookmarkTags = normalizeTags(bookmarks.flatMap((b) => b.tags))
  const bookmarkIcons = normalizeIcons(bookmarks.map((b) => b.icon ?? ''))

  const defaultTags = normalizeTags([...PRESET_TAGS])
  const defaultIcons = normalizeIcons([...PRESET_ICONS])

  const tagCandidates = normalizeTags([...defaultTags, ...bookmarkTags])
  const iconCandidates = normalizeIcons([...defaultIcons, ...bookmarkIcons])

  await Promise.all([
    upsertPresets(auth.userId, 'TAG', tagCandidates),
    upsertPresets(auth.userId, 'ICON', iconCandidates),
  ])

  const presets = await prisma.$queryRaw<PresetRow[]>`
    SELECT "type", "value"
    FROM "public"."UserPreset"
    WHERE "userId" = ${auth.userId}
  `

  const tags = normalizeTags(presets.filter((p) => p.type === 'TAG').map((p) => p.value)).sort()
  const icons = normalizeIcons(presets.filter((p) => p.type === 'ICON').map((p) => p.value))

  return NextResponse.json({ tags, icons })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const { type, value } = body

    if (!type || !value) {
      return new NextResponse('Type and value are required', { status: 400 })
    }

    if (type !== 'TAG' && type !== 'ICON') {
      return new NextResponse('Type must be TAG or ICON', { status: 400 })
    }

    const normalizedValue = type === 'TAG' ? value.toLowerCase().trim() : value.trim()

    // Check if preset already exists
    const existing = await prisma.userPreset.findUnique({
      where: {
        userId_type_value: {
          userId: auth.userId,
          type: type,
          value: normalizedValue
        }
      }
    })

    if (existing) {
      return new NextResponse('Preset already exists', { status: 409 })
    }

    // Create new preset
    const preset = await prisma.userPreset.create({
      data: {
        userId: auth.userId,
        type: type,
        value: normalizedValue
      }
    })

    return NextResponse.json({ success: true, preset })
  } catch (error) {
    console.error('Error creating preset:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
