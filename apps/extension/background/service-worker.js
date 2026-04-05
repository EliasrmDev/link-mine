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
  apiFetchBookmarks,
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

// ─── Page Status Detector ────────────────────────────────────────────────────

// Listen to tab updates and tab activation to check bookmark status
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only check when URL changed and loading is complete
  if (changeInfo.status === 'complete' && tab.url) {
    await checkPageBookmarkStatus(tab.url)
  }
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null)
  if (tab?.url) {
    await checkPageBookmarkStatus(tab.url)
  }
})

/**
 * Check if the current page URL is already bookmarked and update badge accordingly
 */
async function checkPageBookmarkStatus(url) {
  // Skip non-http(s) URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    chrome.action.setBadgeText({ text: '' })
    return
  }

  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    chrome.action.setBadgeText({ text: '' })
    return
  }

  try {
    // Search for bookmark with exact URL match
    const result = await apiFetchBookmarks(refreshToken, { q: url })

    if (result.authError) {
      await clearAllTokens()
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
      chrome.action.setBadgeText({ text: '!' })
      return
    }

    // Check if any bookmark matches exactly this URL
    const exactMatch = result.bookmarks?.some(bookmark => bookmark.url === url)

    if (exactMatch) {
      // Page is already saved - show green checkmark
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })
      chrome.action.setBadgeText({ text: '✓' })
    } else {
      // Page is not saved - show orange plus sign
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' })
      chrome.action.setBadgeText({ text: '+' })
    }
  } catch (error) {
    // Network error or other issue - clear badge
    chrome.action.setBadgeText({ text: '' })
  }
}

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

    // Update page status badge immediately to show it's now saved
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })
    chrome.action.setBadgeText({ text: '✓' })

    // Flash success briefly then return to normal status
    setTimeout(async () => {
      const reminderCount = await getReminderCount()
      updateReminderBadge(reminderCount)
    }, 2000)

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

    // Update page status badge to show it's already saved
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })
    chrome.action.setBadgeText({ text: '✓' })

    setTimeout(async () => {
      const reminderCount = await getReminderCount()
      updateReminderBadge(reminderCount)
    }, 2000)
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
    // Reminders take priority - show reminder count
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' })
    chrome.action.setBadgeText({ text: String(count) })
  } else {
    // No reminders - check page bookmark status for current tab
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url) {
        checkPageBookmarkStatus(tab.url)
      } else {
        chrome.action.setBadgeBackgroundColor({ color: '#00000000' })
        chrome.action.setBadgeText({ text: '' })
      }
    }).catch(() => {
      chrome.action.setBadgeBackgroundColor({ color: '#00000000' })
      chrome.action.setBadgeText({ text: '' })
    })
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
    chrome.tabs.create({ url: 'https://linkmine.eliasrm.dev' })
  }
  // Run an immediate token refresh + reminder check on install/update
  proactiveTokenRefresh().then(checkReminders)
})
