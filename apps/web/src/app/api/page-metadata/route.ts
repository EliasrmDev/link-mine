import { NextRequest, NextResponse } from 'next/server'

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
    const domain = new URL(pageUrl).hostname
    if (html) {
      const fromHtml = extractFaviconFromHtml(html, pageUrl)
      if (fromHtml) return fromHtml
    }
    // Return direct favicon.ico path first, frontend will fallback to Google service
    return `https://${domain}/favicon.ico`
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
        'User-Agent': 'Mozilla/5.0 (compatible; LinkMine/1.0; +https://linkmine.app)',
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
      const domain = new URL(url).hostname.replace('www.', '')
      const domainParts = domain.split('.')
      title = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1)
    } catch {
      title = 'Bookmark'
    }
  }

  const favicon = getFaviconUrl(url, htmlContent)

  return NextResponse.json({ title, favicon, url })
}
