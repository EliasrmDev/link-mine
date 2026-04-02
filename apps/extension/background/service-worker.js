/**
 * LinkMine — Background Service Worker (MV3)
 *
 * Responsibilities:
 *  - Receive auth tokens from web app (external message)
 *  - Handle "save current page" keyboard command
 *  - Proactively refresh the JWT access token before it expires
 *  - Sync pending offline bookmarks
 *  - Check for due reminders and update the badge
 */

import {
  getRefreshToken,
  setRefreshToken,
  setAccessToken,
  clearAllTokens,
  setReminderCount,
  getReminderCount,
} from '../shared/storage.js'
import {
  apiSaveBookmark,
  apiFetchDueReminders,
  apiRefreshAccessToken,
  ensureAccessToken,
  BASE_URL,
} from '../shared/api.js'

// ─── External message: web app sends tokens after OAuth login ─────────────────

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'LINKMINE_AUTH_TOKEN') return

  const { token, accessToken, accessTokenExpiresAt } = message

  if (typeof token !== 'string') {
    sendResponse({ ok: false, error: 'Invalid token payload' })
    return
  }

  // Store refresh token then warm up access token cache
  setRefreshToken(token)
    .then(async () => {
      if (accessToken && accessTokenExpiresAt) {
        // The connect page already issued us an access token — use it
        await setAccessToken(accessToken, accessTokenExpiresAt)
      } else {
        // Older web app version — fetch access token now to warm the cache
        await ensureAccessToken(token)
      }

      chrome.action.setBadgeText({ text: '' })
      checkReminders() // non-blocking: update reminder badge after login

      sendResponse({ ok: true })
    })
    .catch(() => sendResponse({ ok: false }))

  return true // keep message channel open for async sendResponse
})

// ─── Keyboard command: save current tab ──────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-page') return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url || !tab?.id) return

  // Skip non-http(s) URLs
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
    showTabNotification(tab.id, 'Cannot save this page type', 'error')
    return
  }

  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    showTabNotification(tab.id, 'Please sign in to LinkMine first', 'error')
    chrome.action.openPopup?.()
    return
  }

  // Show loading notification
  showTabNotification(tab.id, 'Saving page...', 'info', 1500)

  const bookmark = {
    url: tab.url,
    title: tab.title ?? tab.url,
    tags: [],
    icon: null,
    reminderDate: null,
    folderId: null
  }

  const result = await apiSaveBookmark(bookmark, refreshToken)

  if (result.authError) {
    // Refresh token revoked — clear everything and prompt re-login
    await clearAllTokens()
    showTabNotification(tab.id, 'Session expired. Please sign in again', 'error')
    chrome.action.openPopup?.()
    return
  }

  if (result.ok) {
    showTabNotification(tab.id, `Saved: ${bookmark.title}`, 'success')
    flashBadge('✓', '#22c55e', 2000)

    // Broadcast to web app for real-time sync
    try {
      const accessToken = await ensureAccessToken(refreshToken)
      if (accessToken) {
        fetch(`${BASE_URL}/api/sync/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            type: 'BOOKMARK_CREATED',
            bookmark: result.bookmark
          })
        }).catch(() => {}) // Fire and forget
      }
    } catch {}
  } else if (result.status === 409) {
    showTabNotification(tab.id, 'Page already saved', 'info')
    flashBadge('✓', '#f59e0b', 2000)
  } else {
    const errorMsg = result.error || 'Failed to save page'
    showTabNotification(tab.id, `✕ ${errorMsg}`, 'error')
    flashBadge('!', '#ef4444', 3000)
  }
})

// Helper function to show notifications in tab
async function showTabNotification(tabId, message, type = 'success', duration = 3000) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_NOTIFICATION',
      message,
      variant: type,
      duration
    })
  } catch {
    // Tab might not have content script loaded or be restricted
    console.log('Could not send notification to tab', tabId)
  }
}

// ─── Alarms ──────────────────────────────────────────────────────────────────

// Recreate on each install/update (idempotent — same name replaces itself)
chrome.alarms.create('sync-pending',       { periodInMinutes: 5 })
chrome.alarms.create('refresh-access-token', { periodInMinutes: 45 })
chrome.alarms.create('check-reminders',    { periodInMinutes: 60 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sync-pending')         await syncPending()
  if (alarm.name === 'refresh-access-token') await proactiveTokenRefresh()
  if (alarm.name === 'check-reminders')      await checkReminders()
})

// ─── Offline sync ─────────────────────────────────────────────────────────────

async function syncPending() {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return

  const { pendingBookmarks = [] } = await chrome.storage.local.get('pendingBookmarks')
  if (pendingBookmarks.length === 0) return

  const remaining = []
  for (const bookmark of pendingBookmarks) {
    const result = await apiSaveBookmark(bookmark, refreshToken)

    // 409 means the bookmark is already in the server; treat it as synced
    // so we don't retry forever on every alarm tick.
    if (!result.ok && !result.authError && result.status !== 409) remaining.push(bookmark)
    if (result.authError) break // no point retrying if not authenticated
  }

  await chrome.storage.local.set({ pendingBookmarks: remaining })
}

// ─── Proactive token refresh ──────────────────────────────────────────────────

/**
 * Called every 45 minutes by alarm.
 * Refreshes the access token before it expires (1h lifetime + 2-min buffer =
 * the cached token is good for ~58 min). Refreshing at 45-min intervals
 * ensures there is always a fresh token ready in cache.
 */
async function proactiveTokenRefresh() {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return

  const result = await apiRefreshAccessToken(refreshToken)
  if (result.ok) {
    await chrome.storage.local.set({
      accessToken:       result.accessToken,
      accessTokenExpiry: new Date(result.expiresAt).getTime(),
    })
  } else if (result.status === 401) {
    // Refresh token expired — clear auth and let next popup open trigger re-login
    await clearAllTokens()
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
    chrome.action.setBadgeText({ text: '!' })
  }
}

// ─── Reminder check ───────────────────────────────────────────────────────────

async function checkReminders() {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return

  const { count } = await apiFetchDueReminders(refreshToken)
  await setReminderCount(count)
  updateReminderBadge(count)
}

function updateReminderBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' })
    chrome.action.setBadgeText({ text: String(count) })
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#00000000' })
    chrome.action.setBadgeText({ text: '' })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function flashBadge(text, color, durationMs) {
  chrome.action.setBadgeBackgroundColor({ color })
  chrome.action.setBadgeText({ text })
  setTimeout(() => {
    getReminderCount().then(updateReminderBadge)
  }, durationMs)
}

// ─── On install / update ─────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: 'http://localhost:3000' })
  }
  // Run an immediate token refresh + reminder check on install/update
  proactiveTokenRefresh().then(checkReminders)
})
