import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'

const UpdateGroupingSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
  grouped: z.boolean(),
})

const QuerySchema = z.object({
  domain: z.string().optional(),
})

// GET /api/bookmarks/domain-grouping - Get domain grouping preferences
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { domain } = parsed.data

  try {
    if (domain) {
      // Get specific domain preference
      const preference = await prisma.userPreference.findFirst({
        where: {
          userId: auth.userId,
          key: `domain_grouping:${domain}`,
        },
      })

      return NextResponse.json({
        domain,
        grouped: preference?.value === 'false' ? false : true, // Default to grouped
      })
    } else {
      // Get all domain preferences
      const preferences = await prisma.userPreference.findMany({
        where: {
          userId: auth.userId,
          key: { startsWith: 'domain_grouping:' },
        },
      })

      const domainPreferences = preferences.reduce((acc: Record<string, boolean>, pref: any) => {
        const domain = pref.key.replace('domain_grouping:', '')
        acc[domain] = pref.value === 'false' ? false : true
        return acc
      }, {} as Record<string, boolean>)

      return NextResponse.json(domainPreferences)
    }
  } catch (error) {
    console.error('Failed to fetch domain grouping preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

// POST /api/bookmarks/domain-grouping - Update domain grouping preference
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = UpdateGroupingSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { domain, grouped } = parsed.data

  try {
    await prisma.userPreference.upsert({
      where: {
        userId_key: {
          userId: auth.userId,
          key: `domain_grouping:${domain}`,
        },
      },
      update: {
        value: grouped.toString(),
      },
      create: {
        userId: auth.userId,
        key: `domain_grouping:${domain}`,
        value: grouped.toString(),
      },
    })

    return NextResponse.json({
      domain,
      grouped,
      message: grouped ? 'Domain will be grouped' : 'Domain will be ungrouped'
    })
  } catch (error) {
    console.error('Failed to update domain grouping preference:', error)
    return NextResponse.json(
      { error: 'Failed to update preference' },
      { status: 500 }
    )
  }
}