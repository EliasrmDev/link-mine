/**
 * SavePath — Background Service Worker (MV3)
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
} from '../shared/api.js'

// ─── External message: web app sends tokens after OAuth login ─────────────────

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'SAVEPATH_AUTH_TOKEN') return

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
  if (!tab?.url) return

  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    chrome.action.openPopup?.()
    return
  }

  const result = await apiSaveBookmark(
    { url: tab.url, title: tab.title ?? tab.url, tags: [], folderId: null },
    refreshToken,
  )

  if (result.authError) {
    // Refresh token revoked — clear everything and prompt re-login
    await clearAllTokens()
    chrome.action.openPopup?.()
    return
  }

  if (result.ok) {
    flashBadge('✓', '#22c55e', 2000)
  } else {
    flashBadge('!', '#ef4444', 3000)
  }
})

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
