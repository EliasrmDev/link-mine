import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, badRequest } from '@/lib/api'
import { withRLS } from '@/lib/prisma'

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
    const domain = new URL(url).origin

    return await withRLS(auth.userId, async (tx) => {
      await tx.userPreference.upsert({
        where: {
          userId_key: {
            userId: auth.userId,
            key: `favicon_cache:${domain}`,
          },
        },
        update: { value: faviconUrl },
        create: {
          userId: auth.userId,
          key: `favicon_cache:${domain}`,
          value: faviconUrl,
        },
      })

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Failed to cache favicon:', error)
    return NextResponse.json(
      { error: 'Failed to cache favicon' },
      { status: 500 }
    )
  }
}