/**
 * Typed wrappers around chrome.storage.local.
 * Keeps storage key names in one place.
 *
 * Token hierarchy:
 *   refreshToken  — long-lived opaque token (90 days), stored under 'authToken' for compat
 *   accessToken   — short-lived JWT (1 hour), derived from refreshToken
 */

const KEYS = {
  // Auth — kept as 'authToken' for backward compat with any existing installs
  REFRESH_TOKEN:        'authToken',
  ACCESS_TOKEN:         'accessToken',
  ACCESS_TOKEN_EXPIRY:  'accessTokenExpiry', // Unix ms timestamp

  // Offline queue
  PENDING:              'pendingBookmarks',

  // Folder cache
  FOLDERS_CACHE:        'foldersCache',
  FOLDERS_CACHE_TTL:    'foldersCacheTtl',

  // Reminder badge
  REMINDER_COUNT:       'reminderCount',

  // UI state
  LAST_FILTERS:         'lastFilters',
}

// ─── Refresh token (long-lived, 90 days) ─────────────────────────────────────

export async function getRefreshToken() {
  const data = await chrome.storage.local.get(KEYS.REFRESH_TOKEN)
  return data[KEYS.REFRESH_TOKEN] ?? null
}

/** Alias for backward compat */
export const getToken = getRefreshToken

export async function setRefreshToken(token) {
  await chrome.storage.local.set({ [KEYS.REFRESH_TOKEN]: token })
}

export async function clearRefreshToken() {
  await chrome.storage.local.remove(KEYS.REFRESH_TOKEN)
}

// ─── Access token (short-lived JWT, 1 hour) ───────────────────────────────────

/**
 * Get the cached access token if it is still valid.
 * Returns null if absent or expired (with a 2-minute safety buffer).
 */
export async function getAccessToken() {
  const data = await chrome.storage.local.get([KEYS.ACCESS_TOKEN, KEYS.ACCESS_TOKEN_EXPIRY])
  const token  = data[KEYS.ACCESS_TOKEN]
  const expiry = data[KEYS.ACCESS_TOKEN_EXPIRY]
  if (!token || !expiry) return null
  // 2-minute buffer so we don't use a token about to expire mid-request
  if (Date.now() >= expiry - 2 * 60 * 1000) return null
  return token
}

export async function setAccessToken(token, expiresAt) {
  await chrome.storage.local.set({
    [KEYS.ACCESS_TOKEN]:        token,
    [KEYS.ACCESS_TOKEN_EXPIRY]: new Date(expiresAt).getTime(),
  })
}

export async function clearAccessToken() {
  await chrome.storage.local.remove([KEYS.ACCESS_TOKEN, KEYS.ACCESS_TOKEN_EXPIRY])
}

// ─── Clear all auth (logout) ──────────────────────────────────────────────────

export async function clearAllTokens() {
  await chrome.storage.local.remove([
    KEYS.REFRESH_TOKEN,
    KEYS.ACCESS_TOKEN,
    KEYS.ACCESS_TOKEN_EXPIRY,
  ])
}

// ─── Offline pending queue ────────────────────────────────────────────────────

export async function addPending(bookmark) {
  const data = await chrome.storage.local.get(KEYS.PENDING)
  const list = data[KEYS.PENDING] ?? []
  list.push({ ...bookmark, _pendingAt: Date.now() })
  await chrome.storage.local.set({ [KEYS.PENDING]: list })
}

export async function drainPending() {
  const data = await chrome.storage.local.get(KEYS.PENDING)
  const list = data[KEYS.PENDING] ?? []
  await chrome.storage.local.remove(KEYS.PENDING)
  return list
}

// ─── Folder cache (5-minute TTL) ─────────────────────────────────────────────

export async function cacheFolders(folders) {
  await chrome.storage.local.set({
    [KEYS.FOLDERS_CACHE]:     folders,
    [KEYS.FOLDERS_CACHE_TTL]: Date.now() + 5 * 60 * 1000,
  })
}

export async function getCachedFolders() {
  const data = await chrome.storage.local.get([KEYS.FOLDERS_CACHE, KEYS.FOLDERS_CACHE_TTL])
  if (!data[KEYS.FOLDERS_CACHE] || !data[KEYS.FOLDERS_CACHE_TTL]) return null
  if (Date.now() > data[KEYS.FOLDERS_CACHE_TTL]) return null
  return data[KEYS.FOLDERS_CACHE]
}

// ─── Reminder badge ───────────────────────────────────────────────────────────

export async function setReminderCount(count) {
  await chrome.storage.local.set({ [KEYS.REMINDER_COUNT]: count })
}

export async function getReminderCount() {
  const data = await chrome.storage.local.get(KEYS.REMINDER_COUNT)
  return data[KEYS.REMINDER_COUNT] ?? 0
}

// ─── UI filter state ──────────────────────────────────────────────────────────

export async function saveLastFilters(filters) {
  await chrome.storage.local.set({ [KEYS.LAST_FILTERS]: filters })
}

export async function getLastFilters() {
  const data = await chrome.storage.local.get(KEYS.LAST_FILTERS)
  return data[KEYS.LAST_FILTERS] ?? null
}
