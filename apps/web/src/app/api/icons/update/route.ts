import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'

const BodySchema = z.object({
  oldIcon: z.string().min(1).max(500),
  newIcon: z.string().min(1).max(500),
})

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  try {
    const body = await request.json().catch(() => null)
    if (!body) return badRequest('Invalid JSON body')

    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const { oldIcon, newIcon } = parsed.data

    // Update all bookmarks that have the old icon
    const result = await prisma.bookmark.updateMany({
      where: {
        userId: auth.userId,
        icon: oldIcon
      },
      data: { icon: newIcon }
    })

    return NextResponse.json({ success: true, updated: result.count })
  } catch (error) {
    console.error('Error updating icon:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}