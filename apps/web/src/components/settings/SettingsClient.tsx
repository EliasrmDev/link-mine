'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  AlertTriangle,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Lock,
  LayoutDashboard,
  Palette,
  PanelLeft,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface UserInfo {
  id: string
  name: string | null
  email: string | null
  image: string | null
  provider: string | null
}

interface Props {
  user: UserInfo
  /** Dashboard preferences loaded from DB on the server */
  initialPrefs: Record<string, string>
}

function providerLabel(provider: string | null): string {
  if (!provider) return 'OAuth'
  switch (provider.toLowerCase()) {
    case 'google': return 'Google'
    case 'azure-ad':
    case 'microsoft-entra-id':
    case 'microsoftentraid': return 'Microsoft'
    default: return provider.charAt(0).toUpperCase() + provider.slice(1)
  }
}

function providerColor(provider: string | null): string {
  switch (provider?.toLowerCase()) {
    case 'google': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
    case 'azure-ad':
    case 'microsoft-entra-id':
    case 'microsoftentraid': return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800'
    default: return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
  }
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────

interface DeleteModalProps {
  email: string | null
  onClose: () => void
}

function DeleteAccountModal({ email, onClose }: DeleteModalProps) {
  const [confirmInput, setConfirmInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const expectedValue = email ?? ''
  const canDelete = confirmInput.trim() === expectedValue && expectedValue.length > 0

  // Auto-focus the input when the modal opens
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  async function handleDelete() {
    if (!canDelete || isDeleting) return
    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })

      if (res.status === 204) {
        // Account deleted — sign out and redirect to landing page
        await signOut({ callbackUrl: '/' })
        return
      }

      const data = await res.json().catch(() => ({ error: 'Unexpected error' }))
      setError(data.error ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Modal title="Delete account" onClose={isDeleting ? () => {} : onClose}>
      {/* Warning banner */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/20">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">This action cannot be undone</p>
          <p className="mt-0.5 text-sm text-red-600 dark:text-red-500">
            Deleting your account will permanently remove:
          </p>
        </div>
      </div>

      {/* What will be deleted */}
      <ul className="mb-5 space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
        {[
          'All bookmarks and their metadata',
          'All folders and folder structure',
          'Saved tags, icons, and presets',
          'Extension tokens and active sessions',
          'All account preferences and settings',
          'Your profile and login credentials',
        ].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>

      {/* Confirmation input */}
      <div className="mb-4">
        <label htmlFor="delete-confirm-input" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          To confirm, type{' '}
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            {email ?? 'your email'}
          </span>{' '}
          below
        </label>
        <input
          ref={inputRef}
          id="delete-confirm-input"
          type="email"
          autoComplete="off"
          value={confirmInput}
          onChange={(e) => { setConfirmInput(e.target.value); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && canDelete) handleDelete() }}
          placeholder={email ?? 'your@email.com'}
          className="input w-full"
          disabled={isDeleting}
          aria-describedby={error ? 'delete-error' : undefined}
        />
      </div>

      {/* Error display */}
      {error && (
        <p
          id="delete-error"
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={!canDelete || isDeleting}
          className="btn btn-danger disabled:opacity-40 disabled:cursor-not-allowed"
          aria-busy={isDeleting}
        >
          {isDeleting ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Main Settings Client ─────────────────────────────────────────────────────

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
        checked ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─── Main Settings Client ─────────────────────────────────────────────────────

export function SettingsClient({ user, initialPrefs }: Props) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const initials = getInitials(user.name, user.email)
  const provider = providerLabel(user.provider)

  // ── Dashboard preferences — initialized from DB, saved to DB + localStorage ─
  const [bordersEnabled, setBordersEnabled] = useState<boolean>(
    initialPrefs['dashboard:borders_global'] !== undefined
      ? initialPrefs['dashboard:borders_global'] !== 'false'
      : true,
  )
  const [hiddenBorderCount, setHiddenBorderCount] = useState(0)
  const [sidebarModePref, setSidebarModePref] = useState<'toggle' | 'hover'>(
    initialPrefs['dashboard:sidebar_mode'] === 'hover' ? 'hover' : 'toggle',
  )
  const [defaultSort, setDefaultSort] = useState(
    initialPrefs['dashboard:sort'] ?? 'createdAt|desc',
  )
  const [saving, setSaving] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  // Read localStorage-only state on mount (hidden border overrides)
  useEffect(() => {
    try {
      const hbd = localStorage.getItem('linkmine_hidden_border_domains')
      if (hbd) {
        const arr = JSON.parse(hbd)
        setHiddenBorderCount(Array.isArray(arr) ? arr.length : 0)
      }
    } catch { /* ignore */ }
  }, [])

  // Keep localStorage in sync so the dashboard reads the right values immediately
  useEffect(() => {
    localStorage.setItem('linkmine_borders_global', bordersEnabled ? 'true' : 'false')
  }, [bordersEnabled])

  useEffect(() => {
    localStorage.setItem('linkmine_sidebar_mode', sidebarModePref)
  }, [sidebarModePref])

  useEffect(() => {
    const [sortBy, sortDir] = defaultSort.split('|')
    try {
      const raw = localStorage.getItem('linkmine_filters')
      const current = raw ? JSON.parse(raw) : {}
      localStorage.setItem('linkmine_filters', JSON.stringify({ ...current, sortBy, sortDir }))
    } catch { /* ignore */ }
  }, [defaultSort])

  async function savePref(key: string, value: string) {
    setSaving(true)
    try {
      await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      setSavedKey(key)
      setTimeout(() => setSavedKey(null), 2000)
    } catch { /* silently ignore */ } finally {
      setSaving(false)
    }
  }

  function handleBordersToggle(val: boolean) {
    setBordersEnabled(val)
    void savePref('dashboard:borders_global', val ? 'true' : 'false')
  }

  function handleResetBorderOverrides() {
    localStorage.removeItem('linkmine_hidden_border_domains')
    setHiddenBorderCount(0)
  }

  function handleSidebarModeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const mode = e.target.value as 'toggle' | 'hover'
    setSidebarModePref(mode)
    void savePref('dashboard:sidebar_mode', mode)
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setDefaultSort(val)
    void savePref('dashboard:sort', val)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg p-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="text-gray-300 dark:text-gray-700" aria-hidden="true">/</span>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        {/* ── My Account ───────────────────────────────────────── */}
        <section aria-labelledby="account-heading">
          <div className="mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <h2 id="account-heading" className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              My Account
            </h2>
          </div>

          <div className="card p-6">
            {/* Avatar + name row */}
            <div className="mb-6 flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name ?? 'Profile photo'}
                    fill
                    sizes="64px"
                    className="rounded-full object-cover ring-2 ring-brand-100 dark:ring-brand-900/50"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-600 ring-2 ring-brand-100 dark:bg-brand-900/40 dark:text-brand-300 dark:ring-brand-900/50">
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-900 dark:text-white">
                  {user.name ?? 'No name set'}
                </p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  {user.email ?? '—'}
                </p>
                <span
                  className={`mt-1.5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${providerColor(user.provider)}`}
                >
                  Signed in with {provider}
                </span>
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="settings-name" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  Display name
                </label>
                <input
                  id="settings-name"
                  type="text"
                  readOnly
                  value={user.name ?? ''}
                  className="input w-full cursor-default bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400"
                  aria-describedby="settings-name-hint"
                />
                <p id="settings-name-hint" className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Managed by your {provider} account
                </p>
              </div>

              <div>
                <label htmlFor="settings-email" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Email address
                </label>
                <input
                  id="settings-email"
                  type="email"
                  readOnly
                  value={user.email ?? ''}
                  className="input w-full cursor-default bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400"
                  aria-describedby="settings-email-hint"
                />
                <p id="settings-email-hint" className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Managed by your {provider} account
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Security ─────────────────────────────────────────── */}
        <section aria-labelledby="security-heading">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <h2 id="security-heading" className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Security
            </h2>
          </div>

          <div className="card divide-y divide-gray-100 p-0 dark:divide-gray-800">
            {/* Auth method */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/30">
                  <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Authentication</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {provider} OAuth — single sign-on
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Active
              </span>
            </div>

            {/* Password */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800">
                  <Lock className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Password</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Not applicable — managed by {provider}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                N/A
              </span>
            </div>
          </div>
        </section>

        {/* ── Dashboard ────────────────────────────────────────── */}
        <section aria-labelledby="dashboard-heading">
          <div className="mb-3 flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <h2 id="dashboard-heading" className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Dashboard
            </h2>
            {savedKey && (
              <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Saved
              </span>
            )}
            {saving && !savedKey && (
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">Saving…</span>
            )}
          </div>

          <div className="card divide-y divide-gray-100 p-0 dark:divide-gray-800">

            {/* Colored group borders — global toggle */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                  <Palette className="h-4 w-4 text-blue-500" aria-hidden="true" />
                </div>
                <div>
                  <label htmlFor="toggle-borders" className="text-sm font-medium text-gray-900 dark:text-white">
                    Colored group borders
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Show colored borders on domain-grouped bookmark cards
                  </p>
                </div>
              </div>
              <ToggleSwitch id="toggle-borders" checked={bordersEnabled} onChange={handleBordersToggle} />
            </div>

            {/* Reset per-group border overrides */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800">
                  <RotateCcw className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Per-group overrides</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {hiddenBorderCount > 0
                      ? `${hiddenBorderCount} group${hiddenBorderCount !== 1 ? 's' : ''} with border hidden`
                      : 'No per-group overrides active'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetBorderOverrides}
                disabled={hiddenBorderCount === 0}
                className="btn btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reset
              </button>
            </div>

            {/* Sidebar behavior */}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800">
                  <PanelLeft className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                <div>
                  <label htmlFor="sidebar-mode" className="text-sm font-medium text-gray-900 dark:text-white">
                    Sidebar behavior
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    How the sidebar opens on the dashboard
                  </p>
                </div>
              </div>
              <select
                id="sidebar-mode"
                value={sidebarModePref}
                onChange={handleSidebarModeChange}
                className="input w-36 shrink-0 py-1.5 text-sm"
              >
                <option value="toggle">Click to expand</option>
                <option value="hover">Hover to expand</option>
              </select>
            </div>

            {/* Default sort order */}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800">
                  <ArrowUpDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                <div>
                  <label htmlFor="default-sort" className="text-sm font-medium text-gray-900 dark:text-white">
                    Default sort order
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    How bookmarks are sorted when you open the dashboard
                  </p>
                </div>
              </div>
              <select
                id="default-sort"
                value={defaultSort}
                onChange={handleSortChange}
                className="input w-36 shrink-0 py-1.5 text-sm"
              >
                <option value="createdAt|desc">Newest first</option>
                <option value="createdAt|asc">Oldest first</option>
                <option value="title|asc">Title A → Z</option>
                <option value="title|desc">Title Z → A</option>
              </select>
            </div>

          </div>
        </section>

        {/* ── Danger Zone ──────────────────────────────────────── */}
        <section aria-labelledby="danger-heading">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />
            <h2 id="danger-heading" className="text-sm font-semibold uppercase tracking-wider text-red-500">
              Danger Zone
            </h2>
          </div>

          <div className="rounded-xl border border-red-200 bg-white dark:border-red-900/40 dark:bg-gray-900">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30">
                  <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Delete account</p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    Permanently delete your account and all data. This action cannot be reversed.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn btn-danger shrink-0"
                aria-haspopup="dialog"
              >
                Delete account
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Delete account confirmation modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          email={user.email}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}
