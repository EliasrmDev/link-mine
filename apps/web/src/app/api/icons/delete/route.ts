import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api'
import { withRLS } from '@/lib/prisma'

// DELETE /api/icons/delete
// Delete all instances of an icon from bookmarks and presets
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  try {
    const { icon } = await request.json()

    if (!icon || typeof icon !== 'string') {
      return NextResponse.json({ error: 'Icon is required' }, { status: 400 })
    }

    return await withRLS(auth.userId, async (tx) => {
      await tx.bookmark.updateMany({
        where: { userId: auth.userId, icon },
        data: { icon: null },
      })
      await tx.userPreset.deleteMany({
        where: { userId: auth.userId, type: 'ICON', value: icon },
      })
      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Failed to delete icon:', error)
    return NextResponse.json(
      { error: 'Failed to delete icon' },
      { status: 500 }
    )
  }
}