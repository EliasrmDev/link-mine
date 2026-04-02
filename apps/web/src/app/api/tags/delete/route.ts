import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api'

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const { tag } = body

    if (!tag) {
      return new NextResponse('Tag is required', { status: 400 })
    }

    // Find all bookmarks that contain this tag
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId: auth.userId,
        tags: { has: tag }
      }
    })

    // Remove the tag from all bookmarks
    const updatePromises = bookmarks.map(bookmark => {
      const updatedTags = bookmark.tags.filter(t => t !== tag)
      return prisma.bookmark.update({
        where: { id: bookmark.id },
        data: { tags: updatedTags }
      })
    })

    await Promise.all(updatePromises)

    // Also remove from user presets if it exists
    try {
      await prisma.userPreset.delete({
        where: {
          userId_type_value: {
            userId: auth.userId,
            type: 'TAG',
            value: tag
          }
        }
      })
    } catch {
      // Preset might not exist, which is OK
    }

    return NextResponse.json({ success: true, updated: bookmarks.length })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}