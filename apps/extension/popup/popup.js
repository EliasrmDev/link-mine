/**
 * LinkMine Extension Popup
 * Pure vanilla JS — no build step required.
 */

import {
  getRefreshToken,
  clearAllTokens,
  cacheFolders,
  getCachedFolders,
  addPending,
  getReminderCount,
  setReminderCount,
} from '../shared/storage.js'
import {
  apiCheckAuth,
  apiFetchBookmarks,
  apiFetchDueReminders,
  apiFetchPresets,
  apiFetchFolders,
  apiSaveBookmark,
  apiDeleteBookmark,
  apiUpdateBookmark,
  apiUpdateAccess,
  apiRevokeToken,
  BASE_URL,
} from '../shared/api.js'

const PRESET_ICONS = ['🔖', '📌', '⭐', '🔥', '📚', '💡', '🎯', '🛠️', '📝', '🔗', '🎨', '🔬']
const PRESET_TAGS = ['work', 'study', 'tools', 'design', 'frontend', 'backend', 'ai', 'reading', 'docs', 'inspiration']

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

const pageTitleInput = $('page-title-input')
const pageIconInput  = $('page-icon-input')
const pageUrl      = $('page-url')
const pageFavicon  = $('page-favicon')
const pageIconPicker = $('page-icon-picker')
const pageIconPreview = $('page-icon-preview')
const pageIconFavicon = $('page-icon-favicon')
const pageIconValue = $('page-icon-value')
const pageIconEditor = $('page-icon-editor')
const pageIconPresets = $('page-icon-presets')
const btnEditIcon = $('btn-edit-icon')
const btnClearIcon = $('btn-clear-icon')
const btnCloseIcon = $('btn-close-icon')
const pageTagsInput = $('page-tags-input')
const pageTagPresets = $('page-tag-presets')
const pageReminderInput = $('page-reminder-input')
const folderSelect = $('folder-select')
const saveStatus   = $('save-status')
const recentList   = $('recent-list')
const linkDashboard = $('link-dashboard')

const reminderBanner = $('reminder-banner')
const reminderText   = $('reminder-text')
const reminderLink   = $('reminder-link')
const shortcutBanner = $('shortcut-banner')
const shortcutText   = $('shortcut-text')
const recentSearch   = $('recent-search')

const SAVE_BUTTON_DEFAULT_TEXT = 'Save this page'
const SAVE_BUTTON_DUPLICATE_TEXT = 'Already saved'

// ─── State ────────────────────────────────────────────────────────────────────

let currentTab    = null
let refreshToken  = null
let allBookmarks  = []
let searchTimeout = null
let syncedTags = []
let syncedIcons = []

renderIconPresetButtons()
renderTagPresetButtons()

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

  // Inicializar banner como oculto hasta confirmar reminders
  reminderBanner.hidden = true

  // Set correct shortcut in banner based on OS
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  if (shortcutText) {
    shortcutText.innerHTML = `Quick save: <kbd>${isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S'}</kbd>`
  }

  await refreshTagPresetsFromServer()
  renderTagPresetButtons()
  populateCurrentTab()
  await Promise.all([loadFolders(), loadRecent(), refreshReminderState(), refreshSaveButtonState()])
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  if (!changes.reminderCount) return

  const newCount = Number(changes.reminderCount.newValue ?? 0)
  renderReminderBanner(newCount)
})

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

function updateReminderBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' })
    chrome.action.setBadgeText({ text: String(count) })
    return
  }

  chrome.action.setBadgeText({ text: '' })
}

function renderReminderBanner(count) {
  if (!count || count <= 0) {
    reminderBanner.hidden = true
    reminderBanner.style.display = 'none'
    return
  }

  reminderText.textContent = `${count} reminder${count === 1 ? '' : 's'} due`
  reminderBanner.hidden = false
  reminderBanner.style.display = 'block'
}

async function refreshReminderState() {
  if (!refreshToken) {
    renderReminderBanner(0)
    updateReminderBadge(0)
    return
  }

  const result = await apiFetchDueReminders(refreshToken)
  if (!result.ok) {
    // Si falla la API, asumir 0 reminders para ocultar el banner
    renderReminderBanner(0)
    updateReminderBadge(0)
    return
  }

  const count = result.count || 0
  await setReminderCount(count)
  renderReminderBanner(count)
  updateReminderBadge(count)
}

// ─── Current tab ─────────────────────────────────────────────────────────────

function populateCurrentTab() {
  if (!currentTab) return

  const title  = currentTab.title ?? currentTab.url ?? ''
  const url    = currentTab.url   ?? ''
  const domain = (() => { try { return new URL(url).origin } catch { return '' } })()

  pageTitleInput.value = title
  pageUrl.textContent   = domain
  pageUrl.title = url
  pageIconInput.value = ''
  pageTagsInput.value = ''
  pageReminderInput.value = ''
  pageIconEditor.hidden = true

  if (url) {
    const faviconUrl = getFaviconUrl(url, 32)
    if (faviconUrl) {
      pageFavicon.src = faviconUrl
      pageFavicon.alt = ''
      pageFavicon.onerror = function() {
        if (isLocalUrl(url)) { this.style.display = 'none'; return }
        if (!this.src.includes('google.com/s2/favicons')) {
          this.src = getGoogleFaviconUrl(url, 32)
        } else {
          this.style.display = 'none'
        }
      }
      pageIconFavicon.src = faviconUrl
      pageIconFavicon.alt = ''
      pageIconFavicon.onerror = function() {
        if (isLocalUrl(url)) { this.style.display = 'none'; return }
        if (!this.src.includes('google.com/s2/favicons')) {
          this.src = getGoogleFaviconUrl(url, 32)
        } else {
          this.style.display = 'none'
        }
      }
    }
  }

  updateCurrentIconPreview()
  syncTagPresetState()
}

function renderIconPresetButtons() {
  if (!pageIconPresets) return

  const allPresetIcons = Array.from(new Set([...PRESET_ICONS, ...syncedIcons]))

  pageIconPresets.innerHTML = allPresetIcons.map((icon) => (
    `<button type="button" class="icon-preset" data-icon="${icon}" aria-label="Choose icon ${icon}">${icon}</button>`
  )).join('')

  pageIconPresets.querySelectorAll('.icon-preset').forEach((button) => {
    button.addEventListener('click', () => {
      pageIconInput.value = button.dataset.icon ?? ''
      updateCurrentIconPreview()
    })
  })
}

function updateCurrentIconPreview() {
  const custom = pageIconInput.value.trim()

  if (custom) {
    if (custom.startsWith('http')) {
      // It's a favicon URL
      pageIconValue.hidden = true
      pageIconFavicon.hidden = false
      pageIconFavicon.src = custom
      pageIconFavicon.onerror = function() {
        if (isLocalUrl(custom)) { this.style.display = 'none'; return }
        try {
          const domain = new URL(custom).origin
          if (!this.src.includes('google.com/s2/favicons')) {
            this.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
          } else {
            this.style.display = 'none'
          }
        } catch {
          this.style.display = 'none'
        }
      }
      pageIconValue.textContent = ''
    } else {
      // It's an emoji
      pageIconValue.hidden = false
      pageIconFavicon.hidden = true
      pageIconValue.textContent = custom
    }
  } else {
    pageIconValue.hidden = true
    pageIconFavicon.hidden = false
    pageIconValue.textContent = ''
  }

  if (pageIconPresets) {
    pageIconPresets.querySelectorAll('.icon-preset').forEach((button) => {
      const active = (button.dataset.icon ?? '') === custom
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', active ? 'true' : 'false')
    })
  }
}

function parseTagsInput(raw) {
  const seen = new Set()
  const unique = []

  String(raw ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .forEach((tag) => {
      const normalized = tag.toLowerCase()
      if (!normalized) return
      if (seen.has(normalized)) return
      seen.add(normalized)
      unique.push(normalized)
    })

  return unique
}

function setTagsInput(tags) {
  pageTagsInput.value = tags.join(', ')
  syncTagPresetState()
}

function getSelectedTags() {
  return parseTagsInput(pageTagsInput.value)
}

function renderTagPresetButtons() {
  if (!pageTagPresets) return

  const allPresetTags = parseTagsInput([...PRESET_TAGS, ...syncedTags].join(','))

  pageTagPresets.innerHTML = allPresetTags.map((tag) => (
    `<button type="button" class="tag-preset" data-tag="${tag}" aria-label="Toggle tag ${tag}">${tag}</button>`
  )).join('')

  pageTagPresets.querySelectorAll('.tag-preset').forEach((button) => {
    button.addEventListener('click', () => {
      const tag = button.dataset.tag ?? ''
      const selected = getSelectedTags()
      const next = selected.includes(tag)
        ? selected.filter((t) => t !== tag)
        : [...selected, tag]
      setTagsInput(next)
    })
  })
}

async function refreshTagPresetsFromServer() {
  const result = await apiFetchPresets(refreshToken)
  if (result.authError) {
    await handleAuthError()
    return
  }
  if (!result.ok) return

  syncedTags = parseTagsInput(result.tags.join(','))
  syncedIcons = Array.isArray(result.icons)
    ? result.icons.map((value) => String(value).trim()).filter(Boolean)
    : []
  renderIconPresetButtons()
  renderTagPresetButtons()
  syncTagPresetState()
}

function syncTagPresetState() {
  if (!pageTagPresets) return

  const selected = getSelectedTags()
  pageTagPresets.querySelectorAll('.tag-preset').forEach((button) => {
    const active = selected.includes(button.dataset.tag ?? '')
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', active ? 'true' : 'false')
  })
}

function normalizeUrlForCompare(rawUrl) {
  try {
    const u = new URL(rawUrl)
    u.hash = ''
    return u.toString()
  } catch {
    return String(rawUrl ?? '')
  }
}

function isSameSavedUrl(a, b) {
  return normalizeUrlForCompare(a) === normalizeUrlForCompare(b)
}

function setSaveButtonState({ disabled, text }) {
  btnSave.disabled = disabled
  btnSave.innerHTML = `
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
    ${text}
  `
}

async function refreshSaveButtonState() {
  if (!currentTab?.url) {
    setSaveButtonState({ disabled: true, text: SAVE_BUTTON_DEFAULT_TEXT })
    return
  }

  const result = await apiFetchBookmarks(refreshToken, { q: currentTab.url })
  if (!result.ok || result.authError) return

  const exists = (result.bookmarks ?? []).some((bm) => isSameSavedUrl(bm.url, currentTab.url))
  if (exists) {
    setSaveButtonState({ disabled: true, text: SAVE_BUTTON_DUPLICATE_TEXT })
  } else {
    setSaveButtonState({ disabled: false, text: SAVE_BUTTON_DEFAULT_TEXT })
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
    const domain = (() => { try { return new URL(bm.url).origin } catch { return '' } })()
    const isReminderDue = bm.reminderDate && new Date(bm.reminderDate).getTime() <= Date.now()
    const li = document.createElement('li')
    li.className = `recent-item${isReminderDue ? ' recent-item--reminder' : ''}`
    li.setAttribute('role', 'listitem')

    const iconHtml = bm.icon
      ? bm.icon.startsWith('http')
        ? `<img src="${escapeAttr(bm.icon)}" alt="" width="14" height="14" class="favicon" />`
        : `<span class="recent-icon" aria-hidden="true">${escapeHtml(bm.icon)}</span>`
      : `<img src="${getFaviconUrl(bm.url, 16)}" alt="" width="14" height="14" class="favicon" />`

    li.innerHTML = `
      ${iconHtml}
      <a href="${escapeAttr(bm.url)}" target="_blank" rel="noopener noreferrer"
         title="${escapeAttr(bm.title)}" data-id="${escapeAttr(bm.id)}">
        <span class="recent-title">${escapeHtml(bm.title)}</span>
        <span class="recent-domain">${escapeHtml(domain)}</span>
      </a>
      ${isReminderDue ? '<span class="recent-reminder-badge" title="Reminder due" aria-label="Reminder due">⏰</span>' : ''}
      <div class="recent-actions">
        <button class="recent-edit" data-id="${escapeAttr(bm.id)}"
                aria-label="Edit ${escapeAttr(bm.title)}">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button class="recent-delete" data-id="${escapeAttr(bm.id)}"
                aria-label="Delete ${escapeAttr(bm.title)}">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `

    // Apply favicon error handler programmatically (no inline onerror= allowed by CSP)
    applyFaviconErrorHandler(li.querySelector('.favicon'), bm.url, 16)

    // Track lastAccessed on link click (fire-and-forget)
    li.querySelector('a').addEventListener('click', () => {
      apiUpdateAccess(bm.id, refreshToken)
    })

    li.querySelector('.recent-edit').addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      showEditForm(li, bm)
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
  const actions = li.querySelector('.recent-actions')
  if (actions) actions.hidden = true

  const deleteBtn = li.querySelector('.recent-delete')
  if (deleteBtn) deleteBtn.hidden = true

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
    await refreshReminderState()
    await refreshSaveButtonState()
  })

  confirm.querySelector('.confirm-no').addEventListener('click', (e) => {
    e.stopPropagation()
    confirm.remove()
    if (actions) actions.hidden = false
    if (deleteBtn) deleteBtn.hidden = false
  })

  li.appendChild(confirm)
}

async function showEditForm(li, bm) {
  if (li.querySelector('.recent-edit-form')) return

  li.classList.add('recent-item--editing')

  const actions = li.querySelector('.recent-actions')
  if (actions) actions.hidden = true

  const form = document.createElement('div')
  form.className = 'recent-edit-form'

  // Extract domain from URL for favicon
  const domain = (() => {
    try { return new URL(bm.url).origin }
    catch { return '' }
  })()

  form.innerHTML = `
    <div class="edit-page-info">
      <img class="edit-favicon" src="${getFaviconUrl(bm.url, 32)}" alt="" width="16" height="16" />
      <div class="edit-page-text">
        <p class="edit-page-url" title="${bm.url}">${domain}</p>
      </div>
    </div>

    <div class="edit-field">
      <label class="edit-label">Path name</label>
      <input class="edit-title-input" type="text" maxlength="500" aria-label="Edit bookmark title" />
    </div>

    <div class="edit-field">
      <label class="edit-label">Icon</label>
      <div class="edit-icon-picker">
        <div class="edit-icon-preview" aria-live="polite">
          <img class="edit-icon-favicon" src="${getFaviconUrl(bm.url, 32)}" alt="" width="16" height="16" />
          <span class="edit-icon-value" hidden></span>
        </div>
        <button type="button" class="edit-icon-btn" aria-label="Edit icon" title="Edit icon">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>
      <div class="edit-icon-editor" hidden>
        <div class="edit-icon-presets" role="listbox" aria-label="Preset icons"></div>
        <div class="edit-icon-editor-row">
          <input class="edit-icon-input" type="text" placeholder="custom" autocomplete="off" aria-label="Custom icon" />
          <button type="button" class="edit-btn-clear-icon">Reset</button>
          <button type="button" class="edit-btn-close-icon">Done</button>
        </div>
      </div>
    </div>

    <div class="edit-field">
      <label class="edit-label">Tags</label>
      <div class="edit-tag-presets" role="listbox" aria-label="Preset tags"></div>
      <input class="edit-tags-input" type="text" maxlength="250" placeholder="work, tools, reading" autocomplete="off" aria-label="Bookmark tags" />
    </div>

    <div class="edit-field">
      <label class="edit-label">Save to folder</label>
      <select class="edit-folder-select" aria-label="Edit bookmark folder">
        <option value="">No folder</option>
      </select>
    </div>

    <div class="edit-field">
      <label class="edit-label">Reminder (optional)</label>
      <input class="edit-reminder-input" type="datetime-local" aria-label="Edit reminder date" title="Set a reminder for this bookmark" />
    </div>

    <div class="recent-edit-buttons">
      <button class="edit-save" aria-label="Save changes">Save</button>
      <button class="edit-cancel" aria-label="Cancel edit">Cancel</button>
    </div>
  `

  const titleInput = form.querySelector('.edit-title-input')
  const iconInput = form.querySelector('.edit-icon-input')
  const tagsInput = form.querySelector('.edit-tags-input')
  const folderSelect = form.querySelector('.edit-folder-select')
  const reminderInput = form.querySelector('.edit-reminder-input')
  const iconEditor = form.querySelector('.edit-icon-editor')
  const iconPreview = form.querySelector('.edit-icon-preview')
  const iconValue = form.querySelector('.edit-icon-value')
  const iconFavicon = form.querySelector('.edit-icon-favicon')

  // Apply favicon error handlers programmatically (no inline onerror= allowed by CSP)
  applyFaviconErrorHandler(form.querySelector('.edit-favicon'), bm.url, 32)
  applyFaviconErrorHandler(iconFavicon, bm.url, 32)

  // Set initial values
  titleInput.value = bm.title ?? ''
  iconInput.value = bm.icon ?? ''
  tagsInput.value = bm.tags?.join(', ') ?? ''
  reminderInput.value = bm.reminderDate ? new Date(bm.reminderDate).toISOString().slice(0, 16) : ''

  // Update icon preview
  function updateIconPreview() {
    const custom = iconInput.value.trim()
    if (custom) {
      if (custom.startsWith('http')) {
        // It's a favicon URL
        iconValue.hidden = true
        iconFavicon.hidden = false
        iconFavicon.src = custom
      } else {
        // It's an emoji
        iconValue.textContent = custom
        iconValue.hidden = false
        iconFavicon.hidden = true
      }
    } else {
      iconValue.hidden = true
      iconFavicon.hidden = false
    }
  }

  // Populate folder options
  const { folders = [] } = await chrome.storage.local.get('folders')
  folders.forEach(folder => {
    const option = document.createElement('option')
    option.value = folder.id
    option.textContent = folder.name
    option.selected = folder.id === bm.folderId
    folderSelect.appendChild(option)
  })

  // Render icon presets
  const allPresetIcons = Array.from(new Set([...PRESET_ICONS, ...syncedIcons]))
  const iconPresetsContainer = form.querySelector('.edit-icon-presets')
  iconPresetsContainer.innerHTML = allPresetIcons.map((icon) => (
    `<button type="button" class="icon-preset" data-icon="${icon}" aria-label="Choose icon ${icon}">${icon}</button>`
  )).join('')

  iconPresetsContainer.querySelectorAll('.icon-preset').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation()
      iconInput.value = button.dataset.icon ?? ''
      updateIconPreview()
    })
  })

  // Render tag presets
  const allPresetTags = Array.from(new Set([...PRESET_TAGS, ...syncedTags]))
  const tagPresetsContainer = form.querySelector('.edit-tag-presets')
  const selectedTags = new Set((bm.tags ?? []).map(t => t.toLowerCase()))

  function renderTagPresets() {
    tagPresetsContainer.innerHTML = allPresetTags.map((tag) => {
      const isSelected = selectedTags.has(tag.toLowerCase())
      return `<button type="button" class="tag-preset${isSelected ? ' tag-preset--active' : ''}" data-tag="${tag}" aria-label="Toggle tag ${tag}" aria-pressed="${isSelected}">${tag}</button>`
    }).join('')

    tagPresetsContainer.querySelectorAll('.tag-preset').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation()
        const tag = button.dataset.tag
        if (selectedTags.has(tag)) {
          selectedTags.delete(tag)
        } else {
          selectedTags.add(tag)
        }
        renderTagPresets()
        tagsInput.value = Array.from(selectedTags).join(', ')
      })
    })
  }

  renderTagPresets()

  // Icon editor handlers
  form.querySelector('.edit-icon-btn').addEventListener('click', (e) => {
    e.stopPropagation()
    iconEditor.hidden = !iconEditor.hidden
    if (!iconEditor.hidden) iconInput.focus()
  })

  form.querySelector('.edit-btn-clear-icon').addEventListener('click', (e) => {
    e.stopPropagation()
    iconInput.value = ''
    updateIconPreview()
  })

  form.querySelector('.edit-btn-close-icon').addEventListener('click', (e) => {
    e.stopPropagation()
    iconEditor.hidden = true
  })

  iconInput.addEventListener('input', updateIconPreview)
  updateIconPreview()

  // Tags input manual sync
  tagsInput.addEventListener('input', () => {
    const manualTags = tagsInput.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    selectedTags.clear()
    manualTags.forEach(tag => selectedTags.add(tag))
    renderTagPresets()
  })

  const closeForm = () => {
    form.remove()
    li.classList.remove('recent-item--editing')
    if (actions) actions.hidden = false
  }

  form.querySelector('.edit-cancel').addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    closeForm()
  })

  const saveEdit = async () => {
    const nextTitle = titleInput.value.trim()
    const nextIcon = iconInput.value.trim()
    // Get tags from both presets and manual input
    const presetTags = Array.from(selectedTags)
    const manualTags = tagsInput.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    const allTags = Array.from(new Set([...presetTags, ...manualTags]))
    const nextFolderId = folderSelect.value || null
    const nextReminderDate = reminderInput.value ? new Date(reminderInput.value).toISOString() : null

    if (!nextTitle) {
      showStatus('Title is required.', 'error')
      titleInput.focus()
      return
    }

    const result = await apiUpdateBookmark(
      bm.id,
      {
        title: nextTitle,
        icon: nextIcon || null,
        tags: allTags,
        folderId: nextFolderId,
        reminderDate: nextReminderDate
      },
      refreshToken,
    )

    if (result.authError) {
      await handleAuthError()
      return
    }

    if (!result.ok) {
      showStatus(result.error ?? 'Failed to update.', 'error')
      return
    }

    showStatus('Bookmark updated.', 'success')
    closeForm()
    await loadRecent(recentSearch.value.trim())
    await refreshReminderState()
    await refreshSaveButtonState()
  }

  form.querySelector('.edit-save').addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    await saveEdit()
  })

  form.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      await saveEdit()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeForm()
    }
  })

  li.appendChild(form)
  titleInput.focus()
  titleInput.select()
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

  const title = pageTitleInput.value.trim() || currentTab.title || currentTab.url
  const iconInput = pageIconInput.value.trim()
  let icon = iconInput

  // If no custom icon is set, auto-use the page favicon
  // getFaviconUrl already filters data: URIs, chrome:// and non-public URLs
  if (!iconInput) {
    icon = getFaviconUrl(currentTab.url, 32) || null
  }

  const tags = getSelectedTags()
  const reminderDate = pageReminderInput.value ? new Date(pageReminderInput.value).toISOString() : null

  const bookmark = {
    url: currentTab.url,
    title,
    icon: icon || null,
    tags,
    folderId: folderSelect.value || null,
    reminderDate,
  }

  const result = await apiSaveBookmark(bookmark, refreshToken)

  if (result.authError) {
    await handleAuthError()
    return
  }

  if (result.ok) {
    showStatus('Saved!', 'success')
    setSaveButtonState({ disabled: true, text: '✓ Saved' })
    await refreshTagPresetsFromServer()
    await loadRecent()
    await refreshReminderState()
  } else if (result.status === 409) {
    showStatus('Already saved.', 'success')
    setSaveButtonState({ disabled: true, text: SAVE_BUTTON_DUPLICATE_TEXT })
  } else if (result.status === 0) {
    await addPending(bookmark)
    showStatus('Saved offline — will sync when online.', 'success')
    setSaveButtonState({ disabled: true, text: 'Saved offline' })
  } else {
    showStatus(result.error ?? 'Failed to save. Try again.', 'error')
    setSaveButtonState({ disabled: false, text: SAVE_BUTTON_DEFAULT_TEXT })
  }
})

btnEditIcon.addEventListener('click', () => {
  pageIconEditor.hidden = !pageIconEditor.hidden
  if (!pageIconEditor.hidden) pageIconInput.focus()
})

btnClearIcon.addEventListener('click', () => {
  pageIconInput.value = ''
  updateCurrentIconPreview()
})

btnCloseIcon.addEventListener('click', () => {
  pageIconEditor.hidden = true
})

pageIconInput.addEventListener('input', () => {
  const newValue = pageIconInput.value
  // Allow longer URLs for favicons but limit emoji icons to 10 characters
  if (newValue.startsWith('favicon:') || newValue.startsWith('http')) {
    // No length limit for URLs
  } else {
    pageIconInput.value = newValue.slice(0, 10) // Limit emoji icons to 10 chars
  }
  updateCurrentIconPreview()
})

pageTagsInput.addEventListener('input', () => {
  syncTagPresetState()
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

// Get the best available favicon for a URL
function getFaviconUrl(url, size = 16) {
  let domain = ''
  try {
    domain = new URL(url).origin
  } catch {
    return ''
  }

  // For local/private URLs, always use direct favicon.ico.
  // Chrome's favIconUrl for these pages is a gstatic proxy URL (e.g.
  // t2.gstatic.com/faviconV2?url=http://localhost) that Google can't
  // resolve, so it's useless.
  if (isLocalUrl(url)) {
    return `${domain}/favicon.ico`
  }

  // Try to use current tab's favicon if it matches the domain.
  // Skip data: URIs (too large), chrome:// internals, and any Google/gstatic
  // favicon proxy URLs — those are Chrome substitutes, not the real icon.
  if (currentTab?.favIconUrl &&
      currentTab.favIconUrl !== '' &&
      !currentTab.favIconUrl.startsWith('data:') &&
      !currentTab.favIconUrl.includes('chrome://') &&
      !currentTab.favIconUrl.includes('google.com/s2/favicons') &&
      !currentTab.favIconUrl.includes('gstatic.com/faviconV2') &&
      currentTab.url.includes(domain)) {
    return currentTab.favIconUrl
  }

  // Fallback to direct favicon.ico path on domain
  return `${domain}/favicon.ico`
}

// Helper to get Google favicon service URL as fallback
function getGoogleFaviconUrl(url, size = 16) {
  try {
    const domain = new URL(url).origin
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`
  } catch {
    return ''
  }
}

// Detect local/private network URLs that Google's favicon service cannot reach
function isLocalUrl(url) {
  try {
    const { hostname } = new URL(url)
    return (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localhost')
    )
  } catch {
    return false
  }
}

// Applies a favicon error handler programmatically to avoid inline event handlers (CSP MV3).
function applyFaviconErrorHandler(img, url, size) {
  if (!img) return
  if (isLocalUrl(url)) {
    img.onerror = () => { img.style.display = 'none' }
  } else {
    const fallback = getGoogleFaviconUrl(url, size)
    img.onerror = () => {
      if (!img.src.includes('google.com/s2/favicons')) {
        img.src = fallback
      } else {
        img.style.display = 'none'
      }
    }
  }
}

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
