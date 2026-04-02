import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const { oldIcon, newIcon } = body

    if (!oldIcon || !newIcon) {
      return new NextResponse('Old icon and new icon are required', { status: 400 })
    }

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
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}