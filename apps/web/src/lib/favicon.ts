/**
 * Favicon utilities — shared between BookmarkGrid and DragOverlay.
 */

export function isLocalDomain(domain: string): boolean {
  return (
    domain === 'localhost' ||
    domain.startsWith('127.') ||
    domain.startsWith('192.168.') ||
    domain.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(domain) ||
    domain.endsWith('.local') ||
    domain.endsWith('.localhost')
  )
}

/** Returns the best favicon URL for a given page URL + domain. */
export function getSmartFaviconUrl(url: string, domain: string): string {
  if (!domain) return ''

  try {
    const urlObj = new URL(url)
    const origin = `${urlObj.protocol}//${urlObj.host}`

    // Local/private URLs: Google service can't reach them, use direct path
    if (isLocalDomain(domain)) {
      return `${origin}/favicon.ico`
    }

    // Subdomains: use direct favicon.ico — Google often lacks their favicons
    // Error handler will fall back to Google if the direct path fails
    const domainParts = domain.split('.')
    if (domainParts.length > 2) {
      return `${origin}/favicon.ico`
    }

    // Standard domain — use Google service
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
  } catch {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
  }
}

/** img onError handler with Google fallback and subdomain handling. */
export function handleFaviconError(
  e: React.SyntheticEvent<HTMLImageElement>,
  _url: string,
  domain: string
) {
  const target = e.currentTarget

  // Already on Google service — try root domain for subdomains, then give up
  if (target.src.includes('google.com/s2/favicons')) {
    const domainParts = domain.split('.')
    if (domainParts.length > 2) {
      const rootDomain = domainParts.slice(-2).join('.')
      if (!target.src.includes(encodeURIComponent(rootDomain))) {
        target.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(rootDomain)}&sz=32`
        return
      }
    }
    target.style.display = 'none'
    return
  }

  // Direct favicon.ico failed — local URLs have no Google fallback, just hide
  if (isLocalDomain(domain)) {
    target.style.display = 'none'
    return
  }

  // Public site: fall back to Google service
  target.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
}
