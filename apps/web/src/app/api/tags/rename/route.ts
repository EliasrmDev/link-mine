import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const { oldTag, newTag } = body

    if (!oldTag || !newTag) {
      return new NextResponse('Old tag and new tag are required', { status: 400 })
    }

    // Update all bookmarks that contain the old tag
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId: auth.userId,
        tags: { has: oldTag }
      }
    })

    // Update each bookmark to replace the old tag with the new tag
    const updatePromises = bookmarks.map(bookmark => {
      const updatedTags = bookmark.tags.map(tag => tag === oldTag ? newTag : tag)
      return prisma.bookmark.update({
        where: { id: bookmark.id },
        data: { tags: updatedTags }
      })
    })

    await Promise.all(updatePromises)

    // Also update in user presets if it exists
    try {
      await prisma.userPreset.update({
        where: {
          userId_type_value: {
            userId: auth.userId,
            type: 'TAG',
            value: oldTag
          }
        },
        data: { value: newTag }
      })
    } catch {
      // Preset might not exist, which is OK
    }

    return NextResponse.json({ success: true, updated: bookmarks.length })
  } catch (error) {
    console.error('Error renaming tag:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}