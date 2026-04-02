import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * Centralized auth guard for all dashboard routes.
 *
 * Public paths (no auth required):
 *   /            — landing page
 *   /login       — sign-in page
 *   /api/auth/*  — NextAuth endpoints
 *   /api/extension/refresh — extension token refresh (uses its own token validation)
 *
 * Protected dashboard paths redirect to /login.
 * Protected API paths return 401 (Bearer token routes authenticate themselves).
 */

const PUBLIC_PAGES = new Set(['/', '/login'])
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/extension/refresh']

export default auth((request) => {
  const { pathname } = request.nextUrl
  const session = request.auth

  if (
    PUBLIC_PAGES.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next()
  }

  // Protect dashboard pages
  if (pathname.startsWith('/dashboard') || pathname === '/extension-auth') {
    if (!session?.user?.id) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Protect API routes — only block requests with no Bearer token and no session
  if (pathname.startsWith('/api/') && !session?.user?.id) {
    const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ')
    if (!hasBearer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
