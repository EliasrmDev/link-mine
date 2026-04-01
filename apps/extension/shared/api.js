/**
 * API client for the SavePath web app.
 *
 * Token strategy:
 *  - refreshToken (long-lived, 90 days) — stored in chrome.storage.local
 *  - accessToken  (JWT, 1 hour)          — derived via POST /api/extension/refresh
 *
 * `ensureAccessToken(refreshToken)` is called before every API request.
 * It returns a cached access token when valid, or silently refreshes it.
 * On a hard 401 (refresh token revoked/expired) it returns null — callers
 * set authError: true so the popup can redirect to the login screen.
 */

export const BASE_URL = 'http://localhost:3000'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function jsonHeaders(accessToken) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  }
}

/**
 * Exchange the refresh token for a fresh JWT access token.
 * Called when the cached access token is absent or nearing expiry.
 */
export async function apiRefreshAccessToken(refreshToken) {
  try {
    const res = await fetch(`${BASE_URL}/api/extension/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data.error ?? 'Refresh failed', status: res.status }
    }
    const { accessToken, expiresAt } = await res.json()
    return { ok: true, accessToken, expiresAt }
  } catch {
    return { ok: false, error: 'Network error', status: 0 }
  }
}

/**
 * Returns a valid access token, refreshing silently if the cached one is stale.
 * Returns null if the refresh token is invalid/expired (force re-login).
 *
 * Imported by the service worker and popup — both pass the refreshToken they
 * retrieved from storage.
 */
export async function ensureAccessToken(refreshToken) {
  // Check the local cache first (no network call)
  const { accessToken, accessTokenExpiry } = await chrome.storage.local.get([
    'accessToken',
    'accessTokenExpiry',
  ])

  // 2-minute buffer so we don't use a token about to expire mid-flight
  if (accessToken && accessTokenExpiry && Date.now() < accessTokenExpiry - 2 * 60 * 1000) {
    return accessToken
  }

  // Cache miss or expiring soon — refresh
  const result = await apiRefreshAccessToken(refreshToken)
  if (!result.ok) return null

  await chrome.storage.local.set({
    accessToken:       result.accessToken,
    accessTokenExpiry: new Date(result.expiresAt).getTime(),
  })
  return result.accessToken
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Save a bookmark.
 * Returns { ok: true, bookmark } | { ok: false, error, status, authError? }
 */
export async function apiSaveBookmark(bookmark, refreshToken) {
  const accessToken = await ensureAccessToken(refreshToken)
  if (!accessToken) return { ok: false, error: 'Not authenticated', status: 401, authError: true }

  try {
    const res = await fetch(`${BASE_URL}/api/bookmarks`, {
      method: 'POST',
      headers: jsonHeaders(accessToken),
      body: JSON.stringify(bookmark),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error, status: res.status }
    return { ok: true, bookmark: data }
  } catch {
    return { ok: false, error: 'Network error', status: 0 }
  }
}

/**
 * Fetch recent bookmarks.
 */
export async function apiFetchBookmarks(refreshToken, {
  folderId, q, tags, icon, hasReminder, sortBy, sortDir,
} = {}) {
  const accessToken = await ensureAccessToken(refreshToken)
  if (!accessToken) return { ok: false, bookmarks: [], authError: true }

  try {
    const params = new URLSearchParams({ pageSize: '10' })
    if (folderId)      params.set('folderId', folderId)
    if (q)             params.set('q', q)
    if (tags?.length)  params.set('tags', tags.join(','))
    if (icon)          params.set('icon', icon)
    if (hasReminder)   params.set('hasReminder', 'true')
    if (sortBy)        params.set('sortBy', sortBy)
    if (sortDir)       params.set('sortDir', sortDir)

    const res = await fetch(`${BASE_URL}/api/bookmarks?${params}`, {
      headers: jsonHeaders(accessToken),
    })
    if (!res.ok) return { ok: false, bookmarks: [] }
    const data = await res.json()
    return { ok: true, bookmarks: data.bookmarks, total: data.total }
  } catch {
    return { ok: false, bookmarks: [] }
  }
}

/**
 * Fetch bookmarks with due reminders.
 */
export async function apiFetchDueReminders(refreshToken) {
  const accessToken = await ensureAccessToken(refreshToken)
  if (!accessToken) return { ok: false, count: 0, bookmarks: [] }

  try {
    const params = new URLSearchParams({
      hasReminder: 'true',
      sortBy: 'reminderDate',
      sortDir: 'asc',
      pageSize: '50',
    })
    const res = await fetch(`${BASE_URL}/api/bookmarks?${params}`, {
      headers: jsonHeaders(accessToken),
    })
    if (!res.ok) return { ok: false, count: 0, bookmarks: [] }
    const data = await res.json()

    const now = Date.now()
    const due = (data.bookmarks ?? []).filter(
      (b) => b.reminderDate && new Date(b.reminderDate).getTime() <= now,
    )
    return { ok: true, count: due.length, bookmarks: due }
  } catch {
    return { ok: false, count: 0, bookmarks: [] }
  }
}

/**
 * Record that a bookmark was opened (updates lastAccessed).
 */
export async function apiUpdateAccess(id, refreshToken) {
  const accessToken = await ensureAccessToken(refreshToken)
  if (!accessToken) return { ok: false }

  try {
    const res = await fetch(`${BASE_URL}/api/bookmarks/${id}/access`, {
      method: 'PATCH',
      headers: jsonHeaders(accessToken),
    })
    return { ok: res.ok || res.status === 204 }
  } catch {
    return { ok: false }
  }
}

/**
 * Fetch the folder tree.
 */
export async function apiFetchFolders(refreshToken) {
  const accessToken = await ensureAccessToken(refreshToken)
  if (!accessToken) return { ok: false, folders: [], authError: true }

  try {
    const res = await fetch(`${BASE_URL}/api/folders`, {
      headers: jsonHeaders(accessToken),
    })
    if (!res.ok) return { ok: false, folders: [] }
    return { ok: true, folders: await res.json() }
  } catch {
    return { ok: false, folders: [] }
  }
}

/**
 * Delete a bookmark.
 */
export async function apiDeleteBookmark(id, refreshToken) {
  const accessToken = await ensureAccessToken(refreshToken)
  if (!accessToken) return { ok: false }

  try {
    const res = await fetch(`${BASE_URL}/api/bookmarks/${id}`, {
      method: 'DELETE',
      headers: jsonHeaders(accessToken),
    })
    return { ok: res.ok || res.status === 204 }
  } catch {
    return { ok: false }
  }
}

/**
 * Revoke the refresh token on the server (called on explicit logout).
 * Best-effort — non-critical if it fails.
 */
export async function apiRevokeToken(refreshToken) {
  try {
    // We need an access token to call the protected DELETE endpoint
    const accessToken = await ensureAccessToken(refreshToken)
    if (!accessToken) return { ok: false }

    const res = await fetch(`${BASE_URL}/api/extension/connect`, {
      method: 'DELETE',
      headers: jsonHeaders(accessToken),
    })
    return { ok: res.ok || res.status === 204 }
  } catch {
    return { ok: false }
  }
}

/**
 * Verify that a refresh token is still valid by attempting a token refresh.
 * Returns true if valid, false if expired/revoked.
 */
export async function apiCheckAuth(refreshToken) {
  const result = await apiRefreshAccessToken(refreshToken)
  if (result.ok) {
    // Warm up the access token cache
    await chrome.storage.local.set({
      accessToken:       result.accessToken,
      accessTokenExpiry: new Date(result.expiresAt).getTime(),
    })
    return true
  }
  return false
}
