import { NextRequest, NextResponse } from 'next/server'

// Detect local/private network URLs that Google's favicon service cannot reach
function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localhost')
    )
  } catch {
    return false
  }
}

// Extract favicon URL from HTML <link> tags
function extractFaviconFromHtml(html: string, pageUrl: string): string {
  // Priority: apple-touch-icon > icon > shortcut icon
  const patterns = [
    /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/gi,
    /<link[^>]+rel=["'][^"']*(?:shortcut\s+)?icon[^"']*["'][^>]*>/gi,
  ]

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)]
    for (const match of matches) {
      const hrefMatch = match[0].match(/href=["']([^"']+)["']/)
      if (!hrefMatch) continue
      const href = hrefMatch[1].trim()
      if (!href || href === '#' || href.startsWith('data:')) continue
      try {
        return new URL(href, pageUrl).href
      } catch {
        continue
      }
    }
  }
  return ''
}

// Get favicon URL with multiple fallback strategies
function getFaviconUrl(pageUrl: string, html?: string): string {
  try {
    const urlObj = new URL(pageUrl)
    const { hostname, origin } = urlObj

    // Local/private URLs: Google service can't reach them, return direct path for the browser
    if (isLocalUrl(pageUrl)) {
      return `${origin}/favicon.ico`
    }

    if (html) {
      const fromHtml = extractFaviconFromHtml(html, pageUrl)
      if (fromHtml) {
        const fromHtmlUrl = new URL(fromHtml)
        if (fromHtmlUrl.pathname === '/favicon.ico') {
          // For subdomains, keep the direct path — Google often lacks their favicons
          const parts = fromHtmlUrl.hostname.split('.')
          if (parts.length > 2) return fromHtml
          return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(fromHtmlUrl.hostname)}&sz=32`
        }
        return fromHtml
      }
    }

    // For subdomains, use direct favicon.ico — Google may not index them
    const parts = hostname.split('.')
    if (parts.length > 2) {
      return `${origin}/favicon.ico`
    }

    // Standard domain — use Google service
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
  } catch {
    return ''
  }
}

// Helper to extract title from HTML content
function extractTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (!match) return ''

  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim()
}

// GET /api/page-metadata?url=<url>
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  let title = ''
  let htmlContent: string | undefined = undefined

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkMine/1.0; +https://linkmine.eliasrm.dev)',
      },
    })

    if (response.ok) {
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('text/html')) {
        htmlContent = await response.text()
        title = extractTitleFromHtml(htmlContent)
      }
    }
  } catch (fetchError) {
    console.warn(`Failed to fetch page content for ${url}:`, fetchError)
  }

  // Fallback title: use domain name
  if (!title) {
    try {
      const domain = new URL(url).origin.replace('www.', '')
      const domainParts = domain.split('.')
      title = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1)
    } catch {
      title = 'Bookmark'
    }
  }

  const favicon = getFaviconUrl(url, htmlContent)

  return NextResponse.json({ title, favicon, url })
}
