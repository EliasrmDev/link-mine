# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

LinkMine — bookmark manager with a Chrome extension (MV3, vanilla JS) and a Next.js 15 web app. Users save/organize bookmarks via the extension; the dashboard syncs in real-time via SSE.

## Commands

All commands run from the repo root (npm workspaces):

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (no tests exist)

npm run db:generate  # prisma generate
npm run db:push      # push schema without migration (dev)
npm run db:migrate   # create + apply migration
npm run db:studio    # Prisma Studio GUI
```

Local DB via Docker:
```bash
docker-compose up -d  # starts postgres:16 on :5432, pgadmin on :5050
```

## Architecture

```
apps/
  web/         Next.js 15 App Router — landing, dashboard, all API routes
  extension/   Chrome MV3 — vanilla JS, no bundler
packages/
  shared/      TypeScript types only (@linkmine/shared)
```

### Auth flow

Two separate auth mechanisms share the same API routes:

1. **Web dashboard** — NextAuth v5 (next-auth beta) with Google OAuth + optional Microsoft Entra. Session cookie.
2. **Chrome extension** — long-lived opaque refresh token (90 days, stored in `ExtensionToken` DB table) + short-lived JWT access token (1h, signed with `EXT_API_SECRET`). Extension stores both in `chrome.storage.local`.

Every protected API route calls `requireAuth(request)` from `src/lib/api.ts`, which resolves the user from either session or Bearer token, then calls `setRLSContext(userId)` before any DB access.

### RLS (Row Level Security)

Postgres RLS is enabled on all tables. `setRLSContext(userId)` sets `app.current_user_id` in the DB session so RLS policies automatically scope all queries. This is enforced in addition to application-level `userId` filtering.

### Real-time sync (SSE)

`src/lib/sse.ts` — in-process `EventEmitter` keyed by `userId`. After any bookmark/folder mutation, the API route calls `broadcastToUser(userId, event)`. The dashboard subscribes via `GET /api/sync/stream`. **Single-process only** — multi-instance deployments need Redis pub/sub.

### Extension ↔ Web communication

- `/api/extension/connect` — issues refresh + access tokens (called from `/extension-auth` page after OAuth)
- `/api/extension/refresh` — exchanges refresh token for new JWT access token
- `/api/sync/broadcast` — extension POSTs here after saving to trigger SSE push to dashboard
- Extension service worker uses Chrome alarms: token refresh every 45 min, reminder check every 60 min, offline sync every 5 min

### Folder constraints

Max 2 levels of nesting enforced in application logic (not DB). `Folder.parentId` is nullable; unique constraint on `(userId, parentId, name)`.

### Key patterns

- All API routes: validate with Zod, call `requireAuth`, use `badRequest`/`notFound`/`forbidden` helpers from `src/lib/api.ts`
- Tags are stored as `String[]` on `Bookmark`, normalized (lowercase, deduped) via `normalizeTags()`
- Tag and icon presets auto-saved to `UserPreset` on bookmark create/update
- Favicons cached via `UserPreset` with type `FAVICON_CACHE`

## Environment Variables

Copy `apps/web/.env.local.example` to `apps/web/.env.local`. Required:
- `DATABASE_URL` + `DIRECT_URL` (Prisma needs both for connection pooling vs direct)
- `AUTH_SECRET` / `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `EXT_API_SECRET` — signs extension JWT access tokens

## Extension Development

No build step. Edit files in `apps/extension/` directly. Load unpacked in Chrome from that directory. The extension targets `BASE_URL` defined in `apps/extension/shared/api.js` (points to production or localhost).
