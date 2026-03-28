/**
 * API client for the SavePath web app.
 * All requests use Bearer token auth (extension token).
 *
 * BASE_URL must match the deployed domain.
 * In development: http://localhost:3000
 * In production:  https://yourdomain.com
 */

// Change this to your production URL before publishing to the Chrome Web Store
export const BASE_URL = 'http://localhost:3000'

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

/**
 * Save a bookmark to the server.
 * Returns { ok: true, bookmark } or { ok: false, error, status }
 */
export async function apiSaveBookmark(bookmark, token) {
  try {
    const res = await fetch(`${BASE_URL}/api/bookmarks`, {
      method: 'POST',
      headers: authHeaders(token),
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
 * Fetch recent bookmarks (first page).
 */
export async function apiFetchBookmarks(token, { folderId, q } = {}) {
  try {
    const params = new URLSearchParams({ pageSize: '10' })
    if (folderId) params.set('folderId', folderId)
    if (q) params.set('q', q)

    const res = await fetch(`${BASE_URL}/api/bookmarks?${params}`, {
      headers: authHeaders(token),
    })
    if (!res.ok) return { ok: false, bookmarks: [] }
    const data = await res.json()
    return { ok: true, bookmarks: data.bookmarks, total: data.total }
  } catch {
    return { ok: false, bookmarks: [] }
  }
}

/**
 * Fetch folder tree.
 */
export async function apiFetchFolders(token) {
  try {
    const res = await fetch(`${BASE_URL}/api/folders`, {
      headers: authHeaders(token),
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
export async function apiDeleteBookmark(id, token) {
  try {
    const res = await fetch(`${BASE_URL}/api/bookmarks/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    return { ok: res.ok || res.status === 204 }
  } catch {
    return { ok: false }
  }
}

/**
 * Check if the token is still valid by hitting the session endpoint.
 * Returns the user info or null.
 */
export async function apiCheckAuth(token) {
  try {
    const res = await fetch(`${BASE_URL}/api/bookmarks?pageSize=1`, {
      headers: authHeaders(token),
    })
    return res.ok
  } catch {
    return false
  }
}
