/**
 * SavePath — Background Service Worker (MV3)
 *
 * Responsibilities:
 *  - Receive auth token from web app via externally_connectable
 *  - Handle "save current page" keyboard command
 *  - Sync pending (offline) bookmarks via alarms
 *  - Check for due reminders hourly and show badge count
 *  - Badge management
 */

import { getToken, setReminderCount, getReminderCount } from '../shared/storage.js'
import { apiSaveBookmark, apiFetchDueReminders } from '../shared/api.js'

// ─── External message from web app (extension-auth page) ─────────────────────

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SAVEPATH_AUTH_TOKEN' && typeof message.token === 'string') {
    chrome.storage.local.set({ authToken: message.token }, () => {
      // Re-check reminders after login
      checkReminders()
      sendResponse({ ok: true })
    })
    return true
  }
})

// ─── Keyboard command: save current tab ──────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-page') return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url || !tab?.id) return

  const token = await getToken()
  if (!token) {
    chrome.action.openPopup?.()
    return
  }

  const result = await apiSaveBookmark(
    { url: tab.url, title: tab.title ?? tab.url, tags: [], folderId: null },
    token,
  )

  if (result.ok) {
    flashBadge('✓', '#22c55e', 2000)
  } else {
    flashBadge('!', '#ef4444', 3000)
  }
})

// ─── Alarms ──────────────────────────────────────────────────────────────────

chrome.alarms.create('sync-pending',    { periodInMinutes: 5 })
chrome.alarms.create('check-reminders', { periodInMinutes: 60 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sync-pending')    await syncPending()
  if (alarm.name === 'check-reminders') await checkReminders()
})

// ─── Offline sync ─────────────────────────────────────────────────────────────

async function syncPending() {
  const token = await getToken()
  if (!token) return

  const { pendingBookmarks = [] } = await chrome.storage.local.get('pendingBookmarks')
  if (pendingBookmarks.length === 0) return

  const remaining = []
  for (const bookmark of pendingBookmarks) {
    const result = await apiSaveBookmark(bookmark, token)
    if (!result.ok) remaining.push(bookmark)
  }

  await chrome.storage.local.set({ pendingBookmarks: remaining })
}

// ─── Reminder check ───────────────────────────────────────────────────────────

async function checkReminders() {
  const token = await getToken()
  if (!token) return

  const { count } = await apiFetchDueReminders(token)
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
    // Restore reminder badge if any
    getReminderCount().then(updateReminderBadge)
  }, durationMs)
}

// ─── On install: onboarding + initial reminder check ─────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: 'http://localhost:3000' })
  }
  // Kick off the first reminder check on update/install too
  checkReminders()
})
