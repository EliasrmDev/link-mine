/**
 * Typed wrappers around chrome.storage.local.
 * Keeps storage key names in one place.
 */

const KEYS = {
  AUTH_TOKEN: 'authToken',
  PENDING: 'pendingBookmarks',
  FOLDERS_CACHE: 'foldersCache',
  FOLDERS_CACHE_TTL: 'foldersCacheTtl',
}

/** Retrieve the stored auth token (or null if missing) */
export async function getToken() {
  const data = await chrome.storage.local.get(KEYS.AUTH_TOKEN)
  return data[KEYS.AUTH_TOKEN] ?? null
}

/** Persist auth token */
export async function setToken(token) {
  await chrome.storage.local.set({ [KEYS.AUTH_TOKEN]: token })
}

/** Remove token (logout) */
export async function clearToken() {
  await chrome.storage.local.remove(KEYS.AUTH_TOKEN)
}

/** Add a bookmark to the offline pending queue */
export async function addPending(bookmark) {
  const data = await chrome.storage.local.get(KEYS.PENDING)
  const list = data[KEYS.PENDING] ?? []
  list.push({ ...bookmark, _pendingAt: Date.now() })
  await chrome.storage.local.set({ [KEYS.PENDING]: list })
}

/** Get and clear the pending queue atomically */
export async function drainPending() {
  const data = await chrome.storage.local.get(KEYS.PENDING)
  const list = data[KEYS.PENDING] ?? []
  await chrome.storage.local.remove(KEYS.PENDING)
  return list
}

/** Cache folder list with 5-minute TTL */
export async function cacheFolders(folders) {
  await chrome.storage.local.set({
    [KEYS.FOLDERS_CACHE]: folders,
    [KEYS.FOLDERS_CACHE_TTL]: Date.now() + 5 * 60 * 1000,
  })
}

/** Return cached folders if still fresh, else null */
export async function getCachedFolders() {
  const data = await chrome.storage.local.get([KEYS.FOLDERS_CACHE, KEYS.FOLDERS_CACHE_TTL])
  if (!data[KEYS.FOLDERS_CACHE] || !data[KEYS.FOLDERS_CACHE_TTL]) return null
  if (Date.now() > data[KEYS.FOLDERS_CACHE_TTL]) return null
  return data[KEYS.FOLDERS_CACHE]
}
