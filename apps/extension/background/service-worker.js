/**
 * SavePath — Background Service Worker (MV3)
 *
 * Responsibilities:
 *  - Receive auth token from web app via externally_connectable
 *  - Handle "save current page" keyboard command
 *  - Sync pending (offline) bookmarks via alarms
 *  - Badge management
 */

import { getToken } from '../shared/storage.js'
import { apiSaveBookmark } from '../shared/api.js'

// ─── External message from web app (extension-auth page) ─────────────────────

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SAVEPATH_AUTH_TOKEN' && typeof message.token === 'string') {
    chrome.storage.local.set({ authToken: message.token }, () => {
      chrome.action.setBadgeText({ text: '' })
      sendResponse({ ok: true })
    })
    return true // keep channel open for async response
  }
})

// ─── Keyboard command: save current tab ──────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-page') return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url || !tab?.id) return

  const token = await getToken()
  if (!token) {
    // Not authenticated — open popup
    chrome.action.openPopup?.()
    return
  }

  const result = await apiSaveBookmark(
    { url: tab.url, title: tab.title ?? tab.url, tags: [], folderId: null },
    token,
  )

  if (result.ok) {
    // Flash badge green briefly
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })
    chrome.action.setBadgeText({ text: '✓' })
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000)
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
    chrome.action.setBadgeText({ text: '!' })
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
  }
})

// ─── Offline sync via alarms ──────────────────────────────────────────────────

chrome.alarms.create('sync-pending', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'sync-pending') return
  await syncPending()
})

async function syncPending() {
  const token = await getToken()
  if (!token) return

  const { pendingBookmarks = [] } = await chrome.storage.local.get('pendingBookmarks')
  if (pendingBookmarks.length === 0) return

  const remaining = []
  for (const bookmark of pendingBookmarks) {
    const result = await apiSaveBookmark(bookmark, token)
    if (!result.ok) {
      remaining.push(bookmark) // keep for next attempt
    }
  }

  await chrome.storage.local.set({ pendingBookmarks: remaining })
}

// ─── On install: show onboarding ─────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: 'http://localhost:3000' })
  }
})
