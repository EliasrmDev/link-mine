import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, badRequest } from '@/lib/api'
import { prisma } from '@/lib/prisma'

const CacheFaviconSchema = z.object({
  url: z.string().url('Invalid URL'),
  faviconUrl: z.string().url('Invalid favicon URL'),
})

// POST /api/page-metadata/cache-favicon
// Cache favicon URL for future use, preventing repeated network requests
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = CacheFaviconSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { url, faviconUrl } = parsed.data

  try {
    // Extract domain for caching key
    const domain = new URL(url).hostname

    // Use upsert to cache the favicon URL per domain per user
    // This prevents repeated network calls for the same domain
    await prisma.$executeRaw`
      INSERT INTO "public"."UserPreset" ("id", "userId", "type", "value", "createdAt")
      VALUES (${crypto.randomUUID()}, ${auth.userId}, 'FAVICON_CACHE'::"public"."PresetType", ${JSON.stringify({ domain, faviconUrl })}, NOW())
      ON CONFLICT ("userId", "type", "value") DO UPDATE SET
        "createdAt" = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to cache favicon:', error)
    return NextResponse.json(
      { error: 'Failed to cache favicon' },
      { status: 500 }
    )
  }
}