/**
 * SavePath Extension Popup
 * Pure vanilla JS — no build step required.
 */

import {
  getRefreshToken,
  clearAllTokens,
  cacheFolders,
  getCachedFolders,
  addPending,
  getReminderCount,
} from '../shared/storage.js'
import {
  apiCheckAuth,
  apiFetchBookmarks,
  apiFetchFolders,
  apiSaveBookmark,
  apiDeleteBookmark,
  apiUpdateAccess,
  apiRevokeToken,
  BASE_URL,
} from '../shared/api.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const EXT_ID = chrome.runtime.id
const DASHBOARD_URL = `${BASE_URL}/dashboard`
const LOGIN_URL = `${BASE_URL}/extension-auth?extensionId=${EXT_ID}`

// ─── DOM references ───────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id)

const viewLoading  = $('view-loading')
const viewAuth     = $('view-auth')
const viewMain     = $('view-main')

const btnLogin     = $('btn-login')
const btnSave      = $('btn-save')
const btnTheme     = $('btn-theme')
const btnLogout    = $('btn-logout')

const pageTitle    = $('page-title')
const pageUrl      = $('page-url')
const pageFavicon  = $('page-favicon')
const folderSelect = $('folder-select')
const saveStatus   = $('save-status')
const recentList   = $('recent-list')
const linkDashboard = $('link-dashboard')

const reminderBanner = $('reminder-banner')
const reminderText   = $('reminder-text')
const reminderLink   = $('reminder-link')
const recentSearch   = $('recent-search')

// ─── State ────────────────────────────────────────────────────────────────────

let currentTab    = null
let refreshToken  = null
let allBookmarks  = []
let searchTimeout = null

// ─── Initialise ───────────────────────────────────────────────────────────────

async function init() {
  // Restore theme
  const { theme } = await chrome.storage.local.get('theme')
  if (theme === 'dark') document.documentElement.classList.add('dark')

  linkDashboard.href = DASHBOARD_URL
  reminderLink.href  = DASHBOARD_URL

  // Load current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab = tab

  // Check for stored refresh token
  refreshToken = await getRefreshToken()
  if (!refreshToken) {
    showView('auth')
    return
  }

  // Validate: try to obtain a valid access token (will use cache or refresh)
  const isValid = await apiCheckAuth(refreshToken)
  if (!isValid) {
    // Refresh token expired or revoked → clear everything and prompt re-login
    await clearAllTokens()
    refreshToken = null
    showView('auth')
    return
  }

  // Auth OK — show logout button and populate the UI in parallel
  btnLogout.hidden = false
  showView('main')
  populateCurrentTab()
  await Promise.all([loadFolders(), loadRecent(), showReminderBanner()])
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function logout() {
  // Show auth view immediately — don't wait for network
  btnLogout.hidden = true
  showView('auth')

  // Revoke server-side in background (best-effort)
  if (refreshToken) {
    apiRevokeToken(refreshToken).catch(() => {})
  }

  await clearAllTokens()
  refreshToken = null
}

btnLogout.addEventListener('click', logout)

// ─── Views ───────────────────────────────────────────────────────────────────

function showView(name) {
  viewLoading.hidden = name !== 'loading'
  viewAuth.hidden    = name !== 'auth'
  viewMain.hidden    = name !== 'main'
}

// ─── Reminder banner ──────────────────────────────────────────────────────────

async function showReminderBanner() {
  const count = await getReminderCount()
  if (count <= 0) {
    reminderBanner.hidden = true
    return
  }
  reminderText.textContent = `${count} reminder${count === 1 ? '' : 's'} due`
  reminderBanner.hidden = false
}

// ─── Current tab ─────────────────────────────────────────────────────────────

function populateCurrentTab() {
  if (!currentTab) return

  const title  = currentTab.title ?? currentTab.url ?? ''
  const url    = currentTab.url   ?? ''
  const domain = (() => { try { return new URL(url).hostname } catch { return '' } })()

  pageTitle.textContent = title
  pageTitle.title = title
  pageUrl.textContent   = domain
  pageUrl.title = url

  if (domain) {
    pageFavicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    pageFavicon.alt = ''
  }
}

// ─── Folders ─────────────────────────────────────────────────────────────────

async function loadFolders() {
  // Always fetch fresh on popup open — avoids stale folder list
  const result = await apiFetchFolders(refreshToken)
  if (result.authError) { await handleAuthError(); return }

  const folders = result.ok ? result.folders : (await getCachedFolders() ?? [])
  if (result.ok) await cacheFolders(folders)
  populateFolderSelect(folders)
}

function populateFolderSelect(folders) {
  while (folderSelect.options.length > 1) folderSelect.remove(1)

  for (const folder of folders) {
    addOption(folderSelect, folder.id, folder.name)
    if (folder.children?.length) {
      for (const child of folder.children) {
        addOption(folderSelect, child.id, `  └ ${child.name}`)
      }
    }
  }
}

function addOption(select, value, text) {
  const opt = document.createElement('option')
  opt.value = value
  opt.textContent = text
  select.appendChild(opt)
}

// ─── Recent bookmarks ─────────────────────────────────────────────────────────

async function loadRecent(q = '') {
  const result = await apiFetchBookmarks(refreshToken, q ? { q } : undefined)
  if (result.authError) { await handleAuthError(); return }
  allBookmarks = result.bookmarks ?? []
  renderRecent(allBookmarks)
}

function renderRecent(bookmarks) {
  recentList.innerHTML = ''

  if (bookmarks.length === 0) {
    recentList.innerHTML = '<li class="empty-item">No bookmarks found.</li>'
    return
  }

  for (const bm of bookmarks) {
    const domain = (() => { try { return new URL(bm.url).hostname } catch { return '' } })()
    const isReminderDue = bm.reminderDate && new Date(bm.reminderDate).getTime() <= Date.now()
    const li = document.createElement('li')
    li.className = `recent-item${isReminderDue ? ' recent-item--reminder' : ''}`
    li.setAttribute('role', 'listitem')

    const iconHtml = bm.icon
      ? `<span class="recent-icon" aria-hidden="true">${escapeHtml(bm.icon)}</span>`
      : `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=16"
               alt="" width="14" height="14" class="favicon" onerror="this.style.display='none'" />`

    li.innerHTML = `
      ${iconHtml}
      <a href="${escapeAttr(bm.url)}" target="_blank" rel="noopener noreferrer"
         title="${escapeAttr(bm.title)}" data-id="${escapeAttr(bm.id)}">
        <span class="recent-title">${escapeHtml(bm.title)}</span>
        <span class="recent-domain">${escapeHtml(domain)}</span>
      </a>
      ${isReminderDue ? '<span class="recent-reminder-badge" title="Reminder due" aria-label="Reminder due">⏰</span>' : ''}
      <button class="recent-delete" data-id="${escapeAttr(bm.id)}"
              aria-label="Delete ${escapeAttr(bm.title)}">
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `

    // Track lastAccessed on link click (fire-and-forget)
    li.querySelector('a').addEventListener('click', () => {
      apiUpdateAccess(bm.id, refreshToken)
    })

    // Delete: show inline confirm first
    li.querySelector('.recent-delete').addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      showDeleteConfirm(li, bm.id)
    })

    recentList.appendChild(li)
  }
}

function showDeleteConfirm(li, id) {
  const deleteBtn = li.querySelector('.recent-delete')
  deleteBtn.hidden = true

  const confirm = document.createElement('div')
  confirm.className = 'recent-delete-confirm'
  confirm.innerHTML = `
    <span>Delete?</span>
    <button class="confirm-yes" aria-label="Confirm delete">Yes</button>
    <button class="confirm-no" aria-label="Cancel delete">No</button>
  `

  confirm.querySelector('.confirm-yes').addEventListener('click', async (e) => {
    e.stopPropagation()
    await apiDeleteBookmark(id, refreshToken)
    li.remove()
  })

  confirm.querySelector('.confirm-no').addEventListener('click', (e) => {
    e.stopPropagation()
    confirm.remove()
    deleteBtn.hidden = false
  })

  li.appendChild(confirm)
}

// ─── Search ───────────────────────────────────────────────────────────────────

recentSearch.addEventListener('input', () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadRecent(recentSearch.value.trim())
  }, 300)
})

// ─── Save current page ────────────────────────────────────────────────────────

btnSave.addEventListener('click', async () => {
  if (!currentTab?.url) return
  btnSave.disabled = true

  const bookmark = {
    url: currentTab.url,
    title: currentTab.title ?? currentTab.url,
    tags: [],
    folderId: folderSelect.value || null,
  }

  const result = await apiSaveBookmark(bookmark, refreshToken)

  if (result.authError) {
    await handleAuthError()
    return
  }

  if (result.ok) {
    showStatus('Saved!', 'success')
    btnSave.textContent = '✓ Saved'
    await loadRecent()
  } else if (result.status === 409) {
    showStatus('Already saved.', 'success')
    btnSave.disabled = false
  } else if (result.status === 0) {
    await addPending(bookmark)
    showStatus('Saved offline — will sync when online.', 'success')
  } else {
    showStatus(result.error ?? 'Failed to save. Try again.', 'error')
    btnSave.disabled = false
  }
})

function showStatus(message, type) {
  saveStatus.textContent = message
  saveStatus.className = `status ${type}`
  saveStatus.hidden = false
  setTimeout(() => { saveStatus.hidden = true }, 3500)
}

// ─── Auth error recovery ──────────────────────────────────────────────────────

async function handleAuthError() {
  await clearAllTokens()
  refreshToken = null
  btnLogout.hidden = true
  showView('auth')
}

// ─── Login ────────────────────────────────────────────────────────────────────

btnLogin.addEventListener('click', () => {
  chrome.tabs.create({ url: LOGIN_URL })
  window.close()
})

// ─── Theme toggle ─────────────────────────────────────────────────────────────

btnTheme.addEventListener('click', async () => {
  const isDark = document.documentElement.classList.toggle('dark')
  await chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;')
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

init().catch(console.error)
