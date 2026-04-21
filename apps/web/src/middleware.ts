import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * Centralized auth guard for all dashboard routes with SEO optimizations.
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
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/extension/refresh', '/api/extension/connect', '/api/oauth/authorize', '/api/oauth/token', '/api/oauth/refresh', '/api/oauth/revoke']

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

export default auth((request) => {
  const { pathname, search } = request.nextUrl
  const session = request.auth

  // SEO redirects (301 permanent redirects)
  if (pathname === '/home') {
    return NextResponse.redirect(new URL('/', request.url), { status: 301 })
  }

  if (pathname === '/app') {
    return NextResponse.redirect(new URL('/dashboard', request.url), { status: 301 })
  }

  // Remove trailing slashes for SEO (except root)
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return NextResponse.redirect(
      new URL(pathname.slice(0, -1) + search, request.url),
      { status: 301 }
    )
  }

  // Lowercase redirects for consistency
  if (pathname !== pathname.toLowerCase()) {
    return NextResponse.redirect(
      new URL(pathname.toLowerCase() + search, request.url),
      { status: 301 }
    )
  }

  // Handle public pages
  if (
    PUBLIC_PAGES.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    const response = NextResponse.next()

    // Add SEO headers for public pages
    if (!pathname.startsWith('/api')) {
      response.headers.set('X-Robots-Tag', 'index, follow')
    }

    return response
  }

  // Protect dashboard pages, settings, and auth flows
  if (pathname.startsWith('/dashboard') || pathname === '/settings' || pathname === '/extension-auth' || pathname.startsWith('/oauth/consent')) {
    if (!session?.user?.id) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Dashboard pages should not be indexed
    const response = NextResponse.next()
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  }

  // Protect API routes — only block requests with no Bearer token and no session
  if (pathname.startsWith('/api/') && !session?.user?.id) {
    const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ')
    if (!hasBearer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // API routes should not be indexed
    const response = NextResponse.next()
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  }

  return NextResponse.next()
})

