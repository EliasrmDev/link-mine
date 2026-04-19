# CHANGES.md - Next.js 15 / React 19 Optimization Audit

**Date**: 2026-04-18
**Phase**: 4 - Modern Next.js + React patterns
**Scope**: Rendering strategy, React 19 hooks, script/font optimization

---

## 1. Rendering Strategy

### Landing Page (/) - SSR to SSG
- **Before**: Called `auth()` (reads cookies) forcing dynamic SSR for every visitor just to toggle nav buttons
- **After**: Extracted auth-dependent nav into `<LandingNav />` client component using `useSession()`. Page is now fully static (SSG)
- **Files**:
  - `apps/web/src/app/page.tsx` - Removed `auth()` import/call, removed `async`, replaced inline nav, added `export const metadata`
  - `apps/web/src/components/LandingNav.tsx` - **NEW** - `'use client'`, uses `useSession()`, shows skeleton during loading
- **Impact**: Landing page served from CDN cache instead of computed per-request

### Static Pages - Explicit force-static
- **Before**: Implicitly static (no dynamic data), but no explicit annotation
- **After**: Added `export const dynamic = 'force-static'` to prevent accidental dynamicization
- **Files**: `about/page.tsx`, `contact/page.tsx`, `pricing/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `features/page.tsx`
- **Impact**: Safety net - ensures these never accidentally become dynamic

### Dashboard (/dashboard) - SSR (no change)
- **Verified Correct**: Uses `auth()` + Prisma server-side fetching - must be dynamic SSR
- **No changes needed**

---

## 2. Server/Client Component Boundaries

### Audit Result: No conversions possible
- **Breadcrumb.tsx**: `'use client'` with no hooks, BUT receives `onClick` function props from `DashboardClient` - Server Components cannot receive function props - must stay client
- **SubfolderGrid.tsx**: Same pattern - receives `onNavigate`, `onEdit`, `onDelete` callbacks - must stay client
- **All other dashboard components**: Use hooks (useState, useEffect, useCallback, useMemo) - correctly marked `'use client'`
- **Decision**: All `'use client'` directives are correct. No conversions made.

---

## 3. useOptimistic - Instant Bookmark Deletion

### DashboardClient.tsx
- **Before**: `doDeleteBookmark()` waited for DELETE fetch - UI froze during network request
- **After**: `useOptimistic(bookmarks, (state, deletedId) => state.filter(b => b.id !== deletedId))`
  - Bookmark disappears instantly on delete click
  - If DELETE fetch fails, alert shown, optimistic state automatically reverts (bookmark reappears)
  - `optimisticBookmarks` passed to `<BookmarkGrid>`, actual `bookmarks` kept for `allTags`/`iconsInUse` memos

---

## 4. useTransition - Non-blocking Filter and Search Updates

### DashboardClient.tsx
- **Before**: Filter changes and search triggered synchronous re-renders that could block input
- **After**:
  - `const [isPending, startTransition] = useTransition()`
  - `handleFiltersChange` wraps `fetchBookmarks` in `startTransition` - filter UI stays responsive
  - Search debounce wrapped in `startTransition` - search results load without blocking typing
  - `doDeleteBookmark` wrapped in `startTransition` alongside `useOptimistic`
  - `isPending` combined with `loading` state: `loading={loading || isPending}`

---

## 5. useDeferredValue - React-native Search Debounce

### DashboardClient.tsx
- **Before**: Manual `setTimeout(300ms)` debounce with `searchTimeout` useRef - imperative, race-condition-prone
- **After**: `const deferredQuery = useDeferredValue(query)` + useEffect watching `deferredQuery`
  - `handleSearch` now simply calls `setQuery(q)` - no setTimeout, no ref cleanup
  - React automatically defers the query update, keeping the input responsive
  - Removed `searchTimeout` useRef (no longer needed)

---

## 6. useId - Accessible Form Field IDs

### BookmarkForm.tsx
- **Before**: Hardcoded IDs: `"bm-url"`, `"bm-title"`, `"bm-tags"`, `"bm-reminder"`, `"bm-folder"`
- **After**: `const formId = useId()` - IDs like `${formId}-url`, `${formId}-title`, etc.
- **Impact**: SSR-safe unique IDs, no hydration mismatches, correct label-input accessibility binding

### FolderForm.tsx
- **Before**: Hardcoded ID: `"folder-name"`
- **After**: `const formId = useId()` - `${formId}-name`

---

## 7. Script and Font Optimization

### Google Analytics - Raw script to next/script
- **Before**: Two raw `<script>` tags in `<head>` - render-blocking, loaded synchronously
- **After**: `<Script strategy="afterInteractive">` from `next/script` - deferred loading
- **File**: `apps/web/src/app/layout.tsx`

### Font Preconnects - Redundant removal
- **Before**: 4 redundant `<link>` tags (2x preconnect + 2x dns-prefetch for fonts)
- **After**: Removed all 4. `next/font/google` self-hosts fonts and inlines CSS
- **File**: `apps/web/src/app/layout.tsx`

### Inline Dark Mode Script - Kept intentionally
- Runs synchronously before paint to prevent FOUC - must stay as raw script
- **No change**

---

## 8. Additional Fix: Suspense Boundary

### /extension-auth/callback - Pre-existing build error
- **Before**: `OAuthCallbackClient` uses `useSearchParams()` without Suspense boundary - build crash
- **After**: Wrapped in `<Suspense>` with loading fallback
- **File**: `apps/web/src/app/extension-auth/callback/page.tsx`
- **Note**: Pre-existing error, was blocking the build

---

## 9. Documented Exclusions

### Favicon img Tags - NOT converted to next/image
- **Reason**: Complex `onError` fallback chains incompatible with next/image. Thousands of external domains.

### Server Actions Migration - NOT done
- **Reason**: Dashboard uses single client component tree with SSE sync. High risk for minimal benefit.

### URL-based Search/Filter Persistence - NOT done
- **Reason**: Feature addition, not optimization. Current useDeferredValue pattern works well.

### SSE to Redis Pub/Sub - NOT done
- **Reason**: Infrastructure change outside scope.

---

## Build Verification

```
Route (app)                          Rendering
/                                    static (was dynamic)
/about                               static
/contact                             static
/features                            static
/pricing                             static
/privacy                             static
/terms                               static
/dashboard                           dynamic (correct)
/extension-auth/callback             static
```

- typecheck: PASS (0 errors)
- lint: All errors are pre-existing (none introduced by this audit)
- build: PASS (compilation successful)

---

## Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/app/page.tsx` | Removed `auth()`, added metadata, uses `<LandingNav />` |
| `apps/web/src/components/LandingNav.tsx` | **NEW** - Client component with `useSession()` |
| `apps/web/src/app/about/page.tsx` | Added `export const dynamic = 'force-static'` |
| `apps/web/src/app/contact/page.tsx` | Added `export const dynamic = 'force-static'` |
| `apps/web/src/app/pricing/page.tsx` | Added `export const dynamic = 'force-static'` |
| `apps/web/src/app/privacy/page.tsx` | Added `export const dynamic = 'force-static'` |
| `apps/web/src/app/terms/page.tsx` | Added `export const dynamic = 'force-static'` |
| `apps/web/src/app/features/page.tsx` | Added `export const dynamic = 'force-static'` |
| `apps/web/src/components/dashboard/DashboardClient.tsx` | useOptimistic, useTransition, useDeferredValue |
| `apps/web/src/components/dashboard/BookmarkForm.tsx` | useId for 5 form field pairs |
| `apps/web/src/components/dashboard/FolderForm.tsx` | useId for 1 form field pair |
| `apps/web/src/app/layout.tsx` | next/script for GA, removed font preconnects |
| `apps/web/src/app/extension-auth/callback/page.tsx` | Added Suspense boundary |

---

## 10. Client-Side Filtering + Counter Fix

**Date**: 2026-04-19
**Scope**: Eliminate redundant API requests on view switching; fix bookmark counter mismatch

### Problem 1: Redundant API Requests
- **Before**: Every switch between "All bookmarks", "Unsorted", and folders triggered a `GET /api/bookmarks` call. Search and filter changes also triggered API calls. Switching between views rapidly = wasted requests.
- **After**: ALL bookmarks loaded once via SSR (no `take: 20` limit). View switching, search, tag/icon/sort filtering, and counting happen entirely client-side via `useMemo`. Zero network requests on navigation.

### Problem 2: Counter Mismatch
- **Before**: `dashboard/page.tsx` fetched `take: 20` bookmarks but counted ALL via `tx.bookmark.count()`. BookmarkGrid displayed "49 bookmarks" but only showed 20. No pagination UI existed.
- **After**: All bookmarks loaded. Counter shows `filteredBookmarks.length` — always matches the number of visible bookmarks in the current view.

### Changes

#### `apps/web/src/app/dashboard/page.tsx`
- Removed `take: 20` from `tx.bookmark.findMany()` — loads all user bookmarks
- Removed `tx.bookmark.count()` — no longer needed since `bookmarks.length` is the full count
- Removed `initialTotal` prop from `<DashboardClient>`

#### `apps/web/src/app/api/bookmarks/route.ts`
- Changed `pageSize` max from `100` to `500` and default from `20` to `500`
- Ensures client-side refresh calls (after mutations/SSE) also get all bookmarks

#### `apps/web/src/components/dashboard/DashboardClient.tsx`
- **Removed `initialTotal` prop** and `total` state — count is now derived from `filteredBookmarks.length`
- **Removed `unsortedCount` state** — replaced with `useMemo(() => bookmarks.filter(b => !b.folderId).length)`
- **Added `filteredBookmarks` useMemo** — applies all filters client-side in order:
  1. View filter (all / unsorted / specific folder + child folders)
  2. Search filter (case-insensitive on title, url, tags) using `deferredQuery`
  3. Tag filter (`hasSome` logic)
  4. Icon filter
  5. Reminder filter
  6. Sort (with null handling matching API behavior)
- **Removed fetch calls from**: `navigateToFolder()`, `handleFiltersChange()`, `deferredQuery` useEffect
- **Simplified `fetchBookmarks()`** — no parameters, always fetches all: `/api/bookmarks?pageSize=500`. Used only by mutations (`handleBookmarkSaved`, `doDeleteBookmark`) and `refreshFromServer` (SSE)
- **Simplified `fetchFolders()`** — removed parallel unsorted count API call
- **Simplified `refreshFromServer()`** — no longer depends on `selectedFolderId`/`query`
- **`BookmarkGrid`** now receives `filteredBookmarks` and `filteredBookmarks.length` as total
- Removed unused `countBookmarksInFolderTree`/`countBookmarksInFolders` helper functions
- Removed unused `handleFolderSelect` function

### Impact
- **Zero API requests** on view switching (all/unsorted/folders)
- **Zero API requests** on search or filter changes
- **Accurate counter** — always matches visible bookmarks in every view
- **Faster interactions** — all filtering is instant (no network latency)
- **Fewer API calls overall** — `fetchFolders()` eliminated the extra unsorted count request
- SSE real-time sync and mutations (create/edit/delete) still refresh from server correctly
