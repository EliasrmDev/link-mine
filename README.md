# SavePath

Save, organize, and sync bookmarks across devices — Chrome extension + web dashboard.

```
apps/
  web/        Next.js app (landing page + dashboard + API)
  extension/  Chrome extension (vanilla JS, MV3)
packages/
  shared/     Shared TypeScript types
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Google OAuth credentials ([console.cloud.google.com](https://console.cloud.google.com))

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp apps/web/.env.example apps/web/.env
```

Fill in `apps/web/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/savepath"
AUTH_SECRET="<run: openssl rand -base64 32>"
AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
ALLOWED_EXTENSION_IDS="your-chrome-extension-id"
```

**Google OAuth setup:**
1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add `http://localhost:3000/api/auth/callback/google` to Authorized redirect URIs

### 3. Set up the database

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database (dev)
# or for production:
npm run db:migrate
```

### 4. Run the app

```bash
npm run dev           # starts Next.js on http://localhost:3000
```

### 5. Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `apps/extension` folder
5. Copy the extension ID shown (e.g. `abcdefghijklmnopqrstuvwxyz123456`)
6. Paste it into `ALLOWED_EXTENSION_IDS` in your `.env`

---

## Architecture

### Authentication flow

```
Extension popup
  │
  └─▶ [Not connected] ──▶ Opens /extension-auth?extensionId=<id>
                              │
                              ├─▶ [Not logged in] ──▶ Redirects to /login (Google OAuth)
                              │
                              └─▶ [Logged in]
                                    │
                                    ├─▶ POST /api/extension/connect → creates ExtensionToken
                                    └─▶ chrome.runtime.sendMessage(extensionId, { token })
                                              │
                                              └─▶ background/service-worker.js stores token
                                                  in chrome.storage.local
```

API calls from the extension use `Authorization: Bearer <token>`. API calls from the web dashboard use the NextAuth JWT session cookie. A single `requireAuth()` helper in `src/lib/api.ts` handles both.

### Data model

```
User ──< Folder (max 2 levels deep)
User ──< Bookmark ──> Folder?
User ──< ExtensionToken
```

Unique constraint: one bookmark URL per user (`@@unique([userId, url])`).

### Offline sync

When the extension can't reach the API (network error / `status: 0`), the bookmark is saved to `chrome.storage.local` under `pendingBookmarks`. A `chrome.alarms` listener fires every 5 minutes to retry and flush the queue.

### Folder depth

Max 2 levels enforced in application code (both API routes validate this). The DB schema allows arbitrary depth for future flexibility.

---

## API Reference

All endpoints require auth via session cookie (web) or `Authorization: Bearer <token>` (extension).

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/bookmarks` | List bookmarks (pagination, search, folder filter) |
| POST   | `/api/bookmarks` | Create bookmark |
| PATCH  | `/api/bookmarks/:id` | Update bookmark |
| DELETE | `/api/bookmarks/:id` | Delete bookmark |
| GET    | `/api/bookmarks/export` | Export all as JSON download |
| GET    | `/api/folders` | Get folder tree |
| POST   | `/api/folders` | Create folder |
| PATCH  | `/api/folders/:id` | Rename / reparent folder |
| DELETE | `/api/folders/:id` | Delete folder (bookmarks → unsorted) |
| POST   | `/api/extension/connect` | Issue extension token (requires web session) |
| DELETE | `/api/extension/connect` | Revoke all extension tokens |

---

## Security

- All API inputs validated with Zod before hitting the database
- Every bookmark/folder mutation verifies `userId` ownership (prevents IDOR)
- Extension tokens expire after 365 days; revocable from dashboard
- NextAuth handles CSRF protection for web session mutations
- CSP in `manifest.json` disallows `eval` and external scripts
- No sensitive data stored in extension `localStorage`
- HTTPS enforced in production via `AUTH_URL` + hosting platform

---

## Extension keyboard shortcut

Default: `Ctrl+Shift+S` (Win/Linux) / `Cmd+Shift+S` (Mac).
Saves the current tab silently (no popup required). Badge flashes green on success.

Users can reassign via `chrome://extensions/shortcuts`.

---

## Export / Import

**Export:** Click "Export bookmarks" in the dashboard sidebar → downloads `savepath-bookmarks.json`.

**Import:** Not yet implemented. The JSON format is straightforward — POST to `/api/bookmarks` for each entry.

---

## Building the extension for production

The extension is plain JS — no build step required. To package it:

```bash
cd apps/extension
zip -r ../savepath-extension.zip . --exclude "*.md"
```

Then upload to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

Before publishing, update `manifest.json`:
- Change `host_permissions` to your production domain
- Change `externally_connectable.matches` to your production domain
- Update `BASE_URL` in `shared/api.js`

---

## Deploying the web app

### Vercel (recommended)

```bash
npm i -g vercel
vercel --prod
```

Set all environment variables in the Vercel dashboard.
Use a managed Postgres (Vercel Postgres, Neon, Supabase) and update `DATABASE_URL`.

### Self-hosted

```bash
npm run build
npm start
```

Use a reverse proxy (nginx/Caddy) with HTTPS.

---

## Development

```bash
npm run dev         # web app (hot reload)
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm run db:studio   # Prisma Studio (GUI for DB)
```

---

## Manual test checklist

### Auth
- [ ] Sign in with Google redirects to dashboard
- [ ] Sign out redirects to home
- [ ] Extension "Sign in" button opens `/extension-auth`
- [ ] After login, extension popup shows "Save this page"
- [ ] Token persists across browser restarts

### Bookmarks
- [ ] Save current tab from extension popup
- [ ] Save page via keyboard shortcut
- [ ] Duplicate URL returns "Already saved" (409)
- [ ] Edit bookmark (title, tags, folder)
- [ ] Delete bookmark
- [ ] Search filters results
- [ ] Folder filter works

### Folders
- [ ] Create root folder
- [ ] Create sub-folder (max 1 level deep from root)
- [ ] Attempting to create 3rd level returns error
- [ ] Rename folder
- [ ] Delete folder → bookmarks move to unsorted

### Offline
- [ ] Disable network, save bookmark → queued
- [ ] Re-enable network, wait 5 min (or re-open popup) → synced
