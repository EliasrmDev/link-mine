import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLS } from '@/lib/prisma'
import { requireAuth, badRequest } from '@/lib/api'
import { validateIcon } from '@/lib/icon-validation'

const BodySchema = z.object({
  oldIcon: z.string().min(1).max(2048),
  newIcon: z.string().min(1).max(2048),
})

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0].message)

  const { oldIcon, newIcon } = parsed.data

  // Validate the new icon value
  const validation = validateIcon(newIcon)
  if (!validation.valid) return badRequest(validation.error!)

  try {
    return await withRLS(auth.userId, async (tx) => {
      const result = await tx.bookmark.updateMany({
        where: { userId: auth.userId, icon: oldIcon },
        data: { icon: newIcon.trim() },
      })
      // Also update the preset entry so the preset list stays consistent
      await tx.userPreset.updateMany({
        where: { userId: auth.userId, type: 'ICON', value: oldIcon },
        data: { value: newIcon.trim() },
      })
      return NextResponse.json({ success: true, updated: result.count })
    })
  } catch (error) {
    console.error('Error updating icon:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}