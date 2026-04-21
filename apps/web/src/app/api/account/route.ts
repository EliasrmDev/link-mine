import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api'
import { withRLS } from '@/lib/prisma'

const DeleteAccountSchema = z.object({
  confirm: z.literal(true),
})

/**
 * DELETE /api/account
 *
 * Permanently deletes the authenticated user's account and ALL associated data.
 *
 * Security:
 * - userId is always taken from the verified session/Bearer token — never from the request body.
 * - Requires { confirm: true } in the JSON body as a secondary safeguard.
 * - All deletes run in a single withRLS transaction, so RLS policies apply throughout.
 *
 * Deletion order respects FK constraints:
 *   Bookmarks → Folders → Presets → Preferences → ExtensionTokens →
 *   OAuthCodes → Accounts (NextAuth) → Sessions (NextAuth) → User
 *
 * Note: Bookmark.folderId and Folder.parentId use onDelete: SetNull, so bookmarks
 * must be deleted before folders to avoid orphaned records.
 */
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request)
  if ('error' in authResult) return authResult.error

  const { userId } = authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = DeleteAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Confirmation required to delete account' }, { status: 400 })
  }

  return withRLS(userId, async (tx) => {
    // Guard: verify the user still exists (race condition / replay attack protection)
    const existing = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 1. Bookmarks first — folderId FK references Folder (onDelete: SetNull)
    //    Must delete bookmarks before folders to avoid SetNull triggering on our own rows
    await tx.bookmark.deleteMany({ where: { userId } })

    // 2. Folders — parentId self-reference (onDelete: SetNull); deleting all user folders at once
    //    is safe because Postgres resolves the self-FK within the same statement
    await tx.folder.deleteMany({ where: { userId } })

    // 3. Application resources
    await tx.userPreset.deleteMany({ where: { userId } })
    await tx.userPreference.deleteMany({ where: { userId } })
    await tx.extensionToken.deleteMany({ where: { userId } })
    await tx.oAuthAuthorizationCode.deleteMany({ where: { userId } })

    // 4. NextAuth records
    await tx.account.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })

    // 5. Delete the user row itself — RLS policy on User is FOR ALL USING (id = current_user_id)
    //    so this is permitted within the withRLS context
    await tx.user.delete({ where: { id: userId } })

    return new NextResponse(null, { status: 204 })
  })
}
