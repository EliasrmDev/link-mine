/**
 * Icon validation — shared between API routes and client components.
 *
 * Accepted icon types:
 *   emoji      – Unicode emoji / pictographic sequence (≤ 10 chars)
 *   text       – Short printable symbol/character (≤ 10 chars)
 *   image-url  – Absolute http/https URL
 *
 * Rejected:
 *   empty strings, HTML tags, javascript:/data:/file:/blob: URIs,
 *   strings > 10 chars that are not valid http/https URLs,
 *   URLs > 2 048 chars, malformed URLs.
 */

export type IconType = 'emoji' | 'text' | 'image-url'

export interface IconValidationResult {
  valid: boolean
  type?: IconType
  error?: string
}

/** Schemes that are never allowed regardless of context. */
const BLOCKED_SCHEMES = ['javascript:', 'data:', 'file:', 'blob:', 'vbscript:']

/** Very loose HTML-tag detector — blocks `<anything>` in the value. */
const HTML_TAG_RE = /<[^>]+>/

/**
 * Validate an icon value and return a structured result.
 *
 * @param raw  The raw icon string (may contain leading/trailing whitespace).
 */
export function validateIcon(raw: string): IconValidationResult {
  const value = raw.trim()

  if (!value) {
    return { valid: false, error: 'Icon cannot be empty' }
  }

  // Block HTML tags
  if (HTML_TAG_RE.test(value)) {
    return { valid: false, error: 'Icon cannot contain HTML' }
  }

  const lower = value.toLowerCase()

  // Detect URL-like input (contains a scheme separator)
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.includes('://')) {
    // Only http / https are permitted
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
      return { valid: false, error: 'Only http and https image URLs are allowed' }
    }

    if (value.length > 2048) {
      return { valid: false, error: 'Image URL is too long (max 2 048 characters)' }
    }

    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return { valid: false, error: 'Invalid URL format' }
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only http and https image URLs are allowed' }
    }

    if (!parsed.hostname) {
      return { valid: false, error: 'URL must include a valid hostname' }
    }

    return { valid: true, type: 'image-url' }
  }

  // Block other dangerous scheme prefixes (no :// but still present)
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return { valid: false, error: `"${scheme}" is not allowed as an icon` }
    }
  }

  // Short values: valid emoji or text symbol
  if (value.length <= 10) {
    const isEmoji = /\p{Extended_Pictographic}/u.test(value)
    return { valid: true, type: isEmoji ? 'emoji' : 'text' }
  }

  return {
    valid: false,
    error: 'Icon must be an emoji, a short symbol (≤ 10 chars), or an image URL (https://…)',
  }
}
