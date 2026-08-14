# Developer Guide

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15.x (App Router, React Server Components) |
| Language | TypeScript 5.7 |
| Database | SQLite via `node:sqlite` (Node.js 22 built-in, no ORM) |
| Auth | `iron-session` (AES-encrypted, HTTP-only cookie) |
| UI | shadcn/ui + Radix UI primitives + Tailwind CSS |
| Runtime | Node.js 22 Alpine (standalone Next.js output) |
| Icons | Lucide React |

---

## Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  ┌──────────────┐  ┌───────────────────────────────────────┐│
│  │ Server Pages │  │ Client Components                     ││
│  │ (RSC)        │  │ (Drawer, SortSelect, SearchFilter,    ││
│  │              │  │  DeleteButton, RegistriesClient)      ││
│  └──────┬───────┘  └────────────────┬──────────────────────┘│
└─────────┼──────────────────────────┼─────────────────────────┘
          │ SSR                       │ fetch()
          ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js Server                                              │
│  ┌─────────────────────────┐  ┌───────────────────────────┐ │
│  │ App Router Pages (RSC)  │  │ API Routes                │ │
│  │ /dashboard/*            │  │ /api/auth/*               │ │
│  │ /login                  │  │ /api/registries/*         │ │
│  └───────────┬─────────────┘  │ /api/registry/[id]/*      │ │
│              │                └──────────────┬────────────┘ │
│              ▼                               ▼              │
│  ┌───────────────────────┐  ┌───────────────────────────┐  │
│  │ SQLite DB             │  │ registry-client.ts        │  │
│  │ (registry metadata,   │  │ (Docker Registry V2 API   │  │
│  │  users, sessions)     │  │  client — live data)      │  │
│  └───────────────────────┘  └──────────────┬────────────┘  │
└─────────────────────────────────────────────┼───────────────┘
                                              │ HTTPS
                                              ▼
                                  ┌─────────────────────┐
                                  │ Docker Registry V2  │
                                  │ (self-hosted)       │
                                  └─────────────────────┘
```

### Key Design Decisions

- **Server Components by default.** All pages are React Server Components. Data is fetched directly in the component — no client-side data fetching on initial page load.
- **Client components only where state is needed.** The tag detail drawer, sort selector, search filter, and registry CRUD forms are client components. Everything else is server-rendered.
- **SQLite stores metadata only.** The database holds registry connection details (URL, credentials) and app users. All image/tag/manifest data is fetched live from the registry — nothing is cached or persisted.
- **Lazy API calls on demand.** Tag config details (arch, OS, labels, env, history) are fetched via a dedicated API route only when the user opens the detail drawer — not on page load.
- **Registry client is server-only.** `registry-client.ts` runs exclusively on the server (pages + API routes). Registry credentials never reach the browser.

### Request Flow — Tag Detail Drawer

```
User clicks "Details" on a tag
  → TagDetailDrawer (client) calls fetch()
  → GET /api/registry/[id]/tag-detail?image=...&tag=...
  → API route: reads registry from SQLite
  → getManifest() → /v2/{name}/manifests/{tag}    (registry)
  → getImageConfig() → /v2/{name}/blobs/{digest}  (registry)
  → returns { manifest, imageConfig, configError }
  → Drawer renders full tag details
```

### Request Flow — Tags Page Load

```
Navigate to /dashboard/registry/[id]/image/[...name]
  → Server Component renders
  → getTags() → /v2/{name}/tags/list              (registry)
  → getManifest() × N (parallel)                  (registry)
  → if sort=created: getImageConfig() × N (parallel) (registry)
  → Page renders with sorted tag list
```

---

## Local Dev

```bash
cp .env.example .env.local
# edit .env.local — set ADMIN_USERNAME, ADMIN_PASSWORD, APP_SECRET

npm install
npm run dev
# → http://localhost:3000

npm test      # node --test — pure unit tests, no DB or network
npm run build # required before every commit that touches src/
```

SQLite DB is created at `./data/registry-ui.db` on first run. The admin user is seeded automatically from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_USERNAME` | No | Admin username seeded on first run (default: `admin`) |
| `ADMIN_PASSWORD` | No | Admin password seeded on first run (default: `admin`) |
| `APP_SECRET` | **Yes** (prod) | Session encryption key — must be 32+ chars — `openssl rand -hex 32` |
| `DB_PATH` | No | SQLite path — auto-defaults to `/data/registry-ui.db` in production, `./data/registry-ui.db` in dev |
| `RETENTION_AUTO` | No | `false` disables the background retention sweep started in `src/instrumentation.ts` |
| `RETENTION_INTERVAL_HOURS` | No | Sweep interval, default `24`. The first sweep runs one interval after boot, never at boot |

> `APP_SECRET` defaults to a hardcoded fallback in development but **must** be set in production. If it changes, all existing sessions are invalidated.

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts          POST — validate credentials, set session cookie
│   │   │   ├── logout/route.ts         POST — clear session cookie
│   │   │   └── me/route.ts             GET  — return current session user
│   │   ├── registries/
│   │   │   ├── route.ts                GET (list), POST (create) — admin only
│   │   │   ├── [id]/route.ts           PUT (update), DELETE — admin only
│   │   │   └── check/route.ts          POST — ping registry + get repo count
│   │   ├── registry/[id]/
│   │   │   ├── delete/route.ts         DELETE — remove one tag by digest, or a batch of tags
│   │   │   ├── retention/run/route.ts  POST — run the retention sweep for one registry
│   │   │   └── tag-detail/route.ts     GET  — fetch manifest + config blob for a tag
│   │   └── users/
│   │       ├── route.ts                GET (list), POST (create) — admin only
│   │       └── [id]/route.ts           PUT (update), DELETE — admin only
│   ├── dashboard/
│   │   ├── page.tsx                    Registry list (card + list view, env badges, online status)
│   │   ├── layout.tsx                  Sidebar + header shell
│   │   ├── registry/
│   │   │   └── [id]/
│   │   │       ├── page.tsx            Image list (searchable, with tag counts)
│   │   │       ├── tag/page.tsx        Tag detail standalone page (?image=&tag=)
│   │   │       └── image/[...name]/
│   │   │           ├── page.tsx        Tag list (sortable: created/name/size, latest badge)
│   │   │           ├── tag-list.tsx             Tag rows + bulk selection (client)
│   │   │           ├── tag-detail-drawer.tsx   Lazy detail drawer (client)
│   │   │           ├── sort-select.tsx          Sort control (client)
│   │   │           └── delete-tag-button.tsx    Delete with confirm (client)
│   │   ├── deleted/                    Deleted-tags audit log (+ registry/image filter)
│   │   ├── docs/                       Built-in manual and FAQ
│   │   └── admin/
│   │       ├── registries/             Registry CRUD + connectivity test + retention policy
│   │       └── users/                  User management + role assignment
│   └── login/
├── components/
│   ├── sidebar.tsx                     Nav sidebar with role-aware links
│   ├── header.tsx                      Top bar with user menu + theme toggle
│   ├── search-filter.tsx               URL-param driven search input (client)
│   ├── env-badge.tsx                   Production/staging/local colour badge
│   ├── view-toggle.tsx                 List/card view switcher
│   └── ui/                             shadcn/ui components
│       ├── sheet.tsx                   Right-side drawer (Radix Dialog based)
│       └── ...
└── lib/
    ├── db.ts                           SQLite singleton, auto-migrate, admin seed
    ├── auth.ts                         getSession, requireAuth, requireAdmin helpers
    ├── registry-client.ts              Docker Registry V2 API client
    ├── deleted-log.ts                  recordDeletion — single write point for the audit log
    ├── retention.ts                    Retention sweep + parseRetention payload validation
    ├── tag-match.ts                    Protected-tag glob matching (dependency-free, unit-tested)
    ├── tag-match.test.ts               node:test — `npm test`
    └── utils.ts                        cn, formatBytes, formatDate, formatRelativeDate, apiError, PublicError
```

`src/instrumentation.ts` is the only background process: Next calls `register()` once per server
boot, and it schedules `runRetentionAll()` on an interval.

---

## Key Libraries

### `src/lib/registry-client.ts`

All Docker Registry V2 API calls go through here. Never call the registry directly from pages.

**Exported functions:**

| Function | Endpoint | Notes |
|----------|----------|-------|
| `pingRegistry(config)` | `GET /v2/` | Returns `true` for 200 or 401 |
| `getCatalog(config)` | `GET /v2/_catalog` | Auto-paginates via `Link` header |
| `getTags(config, name)` | `GET /v2/{name}/tags/list` | Auto-paginates |
| `getManifest(config, name, ref)` | `GET /v2/{name}/manifests/{ref}` | Returns digest, size, layers, mediaType, configDigest |
| `getImageConfig(config, name, digest)` | `GET /v2/{name}/blobs/{digest}` | Returns arch, OS, created, labels, env, ports, history |
| `deleteManifest(config, name, digest)` | `DELETE /v2/{name}/manifests/{digest}` | Throws `PublicError` — 405 → "Delete not enabled on registry…", 404 → already deleted, else the status |
| `listTagsWithMeta(config, name, withCreated?)` | tags + manifests (+ config blobs) | Shared by the tag page and the retention sweep; `withCreated` costs one extra request per tag |
| `sortTagsByCreated(list)` | — | Newest build first, undated tags last, `latest` pinned to the top |

**Auth handling:** Every request first attempts Basic auth (if credentials present). On `401`, the `WWW-Authenticate` header is parsed — if it's a Bearer challenge, a token is fetched from the realm URL and the request is retried once with `Authorization: Bearer <token>`.

**Manifest types returned by `getManifest`:**

| `mediaType` | Config blob available | Notes |
|-------------|----------------------|-------|
| `vnd.docker.distribution.manifest.v2+json` | ✓ | Standard single-platform image |
| `vnd.oci.image.manifest.v1+json` | ✓ | OCI equivalent |
| `vnd.docker.distribution.manifest.list.v2+json` | ✗ | Multi-arch list — no config blob |
| `vnd.oci.image.index.v1+json` | ✗ | OCI index — no config blob |
| `vnd.docker.distribution.manifest.v1+json` | ✗ | Legacy v1 — no config blob |

> If using `docker/build-push-action@v6`, set `provenance: false` in your workflow. Without it, single-platform images are wrapped in an OCI image index, making the config blob inaccessible.

### `src/lib/db.ts`

SQLite singleton using Node.js 22 built-in `node:sqlite`. Runs schema migrations and seeds the admin user on first boot. Access pattern:

```ts
import db from '@/lib/db'
const row = db.prepare('SELECT * FROM registries WHERE id = ?').get(id)
```

**Schema:**

```sql
registries   (id, name, url, username, password, environment,
              retention_keep_last, retention_protect, created_at)
users        (id, username, password_hash, role, created_at)
deleted_tags (id, registry_id, image, tag, digest, size, reason, deleted_by, deleted_at)
```

`registries.retention_keep_last` is `0` when cleanup is off (the default, including for every
pre-existing row after migration); `retention_protect` is a comma-separated pattern list.
`deleted_tags` has no foreign key on purpose — the log outlives a removed registry, so the page
resolves the registry name with a `LEFT JOIN` and falls back to `registry #N (removed)`.
`deleted_at` is stored as ISO-8601 with a `Z` suffix, because `datetime('now')` is UTC but parses
as local time in JavaScript.

Columns are added with the tolerated-failure pattern already used for `environment`:

```ts
try { db.exec('ALTER TABLE registries ADD COLUMN retention_keep_last INTEGER NOT NULL DEFAULT 0') } catch {}
```

### `src/lib/auth.ts`

```ts
getSession()      // → SessionData — always safe to call, returns empty session if unauthenticated
requireAuth()     // → throws 'UNAUTHORIZED' if no session
requireAdmin()    // → throws 'UNAUTHORIZED' or 'FORBIDDEN' if not admin
```

Errors thrown by `requireAuth`/`requireAdmin` are caught by `apiError()` in `utils.ts` and returned as `401`/`403` JSON responses.

### Error handling — `apiError` and `PublicError`

`apiError(e)` is the single catch-all every route uses. It maps, in order:

1. `'UNAUTHORIZED'` / `'FORBIDDEN'` sentinels → `401` / `403`
2. `PublicError` → its own message and status
3. anything else → `console.error` plus `{ error: 'Internal server error' }`, `500`

`PublicError` exists so operator-actionable failures reach the user without opening the door to
leaking internals. Throw it only for messages written for a human that contain no response bodies,
paths or stack data — `deleteManifest` is the reference case. Registry helpers that embed raw
response bodies (`getCatalog`, `getTags`, `getManifest`) deliberately stay plain `Error`.

### `src/lib/retention.ts`

```ts
runRetentionForRegistry(id)  // → { deleted, errors } — one registry, used by the API route
runRetentionAll()            // → void — every registry with retention_keep_last > 0, used by the timer
parseRetention(keep, protect) // → { keepLast, protect } | null — payload validation for the registry routes
```

Per image: `listTagsWithMeta(config, image, true)` → `sortTagsByCreated` → drop protected tags
(`isProtected` from `tag-match.ts`) → delete everything past `keepLast`. A digest is deleted once
even when several doomed tags share it, and every tag is logged separately. The sweep is N+1 over
the registry API (`getTags` plus a manifest and a config blob per tag) — fine for tens of images,
worth a cache before it is pointed at thousands.

Validation lives in `retention.ts` rather than the route file because App Router route modules may
only export HTTP handlers.

---

## Data Models

### Registry (SQLite)

```ts
interface Registry {
  id: number
  name: string                            // display name
  url: string                             // e.g. https://registry.example.com
  username: string                        // empty string if no auth
  password: string                        // stored plaintext — use strong APP_SECRET
  environment: 'production' | 'staging' | 'local'
  retention_keep_last: number             // 0 = automatic cleanup off
  retention_protect: string               // "latest, v*, prod-*" — never deleted
  created_at: string                      // ISO datetime
}
```

### DeletedTag (SQLite)

```ts
interface DeletedTag {
  id: number
  registry_id: number                     // no FK — may point at a removed registry
  image: string
  tag: string
  digest: string
  size: number                            // bytes, 0 when unknown
  reason: 'manual' | 'retention'
  deleted_by: string                      // username, empty for the automatic sweep
  deleted_at: string                      // ISO-8601 UTC with Z suffix
}
```

### Session

```ts
interface SessionUser {
  id: number
  username: string
  role: 'super_admin' | 'admin' | 'viewer'
}
```

### ImageConfig (from config blob)

```ts
interface ImageConfig {
  architecture: string | null             // amd64, arm64, etc.
  os: string | null                       // linux, windows
  created: string | null                  // ISO datetime
  author: string | null
  labels: Record<string, string> | null   // LABEL in Dockerfile
  env: string[] | null                    // ENV — ["KEY=value", ...]
  exposedPorts: string[] | null           // EXPOSE — ["80/tcp", ...]
  workingDir: string | null               // WORKDIR
  entrypoint: string[] | null             // ENTRYPOINT
  cmd: string[] | null                    // CMD
  history: Array<{                        // build layer history
    created?: string
    created_by?: string                   // RUN/COPY/ADD command
    empty_layer?: boolean
  }>
}
```

---

## API Routes Reference

All routes return JSON. Auth errors return `{ error: "Unauthorized" }` (401) or `{ error: "Forbidden" }` (403).

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/auth/login` | — | Set session cookie |
| `POST` | `/api/auth/logout` | — | Clear session cookie |
| `GET` | `/api/auth/me` | Any | Return current user |
| `GET` | `/api/registries` | Admin | List all registries |
| `POST` | `/api/registries` | Admin | Create registry |
| `PUT` | `/api/registries/[id]` | Admin | Update registry |
| `DELETE` | `/api/registries/[id]` | Admin | Delete registry |
| `POST` | `/api/registries/check` | Admin | Ping registry, return repo count |
| `GET` | `/api/registry/[id]/tag-detail` | Any | Fetch manifest + config for one tag |
| `DELETE` | `/api/registry/[id]/delete` | Admin | Delete one tag (`{ name, tag, digest }`) or a batch (`{ name, tags: [{ tag, digest, size }] }`, max 100) |
| `POST` | `/api/registry/[id]/retention/run` | Admin | Run the retention sweep now → `{ deleted, errors }` |
| `GET` | `/api/users` | Admin | List users |
| `POST` | `/api/users` | Admin | Create user |
| `PUT` | `/api/users/[id]` | Admin | Update user / change role |
| `DELETE` | `/api/users/[id]` | Admin | Delete user |

---

## Manual API Testing (Bruno)

A Bruno collection is included at `bruno/` for testing the Docker Registry V2 API directly.

```
bruno/
├── bruno.json
├── environments/
│   └── Local.bru       ← set baseUrl, username, password here
├── 01 Ping Registry.bru
├── 02 Get Catalog.bru
├── 03 Get Tags.bru
├── 04 Get Manifest.bru  ← copy config.digest → configDigest env var
├── 05 Get Config Blob.bru
└── 06 Delete Tag.bru    ← uses manifest digest, not tag name
```

Open the `bruno/` folder in [Bruno](https://www.usebruno.com/) as a collection. Set environment variables in `Local.bru` before running.

---

## Docker Build (Local)

```bash
# Build image locally
docker build -t registry-ui:dev .

# Run
docker run -p 3000:3000 \
  -v registry-ui-data:/data \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin \
  -e APP_SECRET=$(openssl rand -hex 32) \
  registry-ui:dev

# Or with compose (builds + starts in one step)
docker compose up --build
```

---

## Release Process

> **Full rules are enforced in `CLAUDE.md`. This section is the human reference.**

### Checklist — every release, no exceptions

```
[ ] 1. npm run build passes with zero TypeScript errors
[ ] 2. CHANGELOG.md updated — [Unreleased] items moved to new [x.y.z] section
[ ] 3. README.md updated if any user-facing feature changed
[ ] 4. DEVELOPER.md updated if architecture / API / tooling changed
[ ] 5. All changes committed (docs in same or prior commit)
[ ] 6. Annotated tag created and pushed
[ ] 7. GitHub Release created via gh release create
```

### Commands

```bash
# 1. Commit everything
git add .
git commit -m "feat: description"   # or fix: / docs: / chore:
git push origin main

# 2. Annotated tag  (never lightweight)
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z

# 3. GitHub Release  (immediately after tag push)
gh release create vX.Y.Z \
  --title "vX.Y.Z — Short description" \
  --latest \
  --notes "..."
```

Tags trigger CI (`.github/workflows/docker-publish.yml`) which builds multi-arch (`linux/amd64` + `linux/arm64`) and pushes to Docker Hub:
- `byteoath/registry-ui:X.Y.Z`
- `byteoath/registry-ui:X.Y`
- `byteoath/registry-ui:latest`

### Semver guide

| Change type | Bump | Example |
|-------------|------|---------|
| Bug fix, docs, chore | Patch `x.y.Z` | `1.0.2 → 1.0.3` |
| New feature, backward-compatible | Minor `x.Y.0` | `1.0.3 → 1.1.0` |
| Breaking change | Major `X.0.0` | `1.1.0 → 2.0.0` |

### CHANGELOG format

Follows [Keep a Changelog](https://keepachangelog.com). Allowed section labels: `Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`.

```markdown
## [Unreleased]

## [1.0.3] - 2026-06-01

### Fixed
- ...
```

### Required GitHub Secrets

| Secret | Value |
|--------|-------|
| `DOCKERHUB_USERNAME` | `byteoath` |
| `DOCKERHUB_TOKEN` | Docker Hub token — **Read, Write, Delete** scope required |

Generate: [Docker Hub](https://hub.docker.com) → Account Settings → Personal access tokens.

### Manual publish (no CI)

```bash
docker buildx create --use --name multiarch
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --provenance=false \
  -t byteoath/registry-ui:X.Y.Z \
  -t byteoath/registry-ui:latest \
  --push .
```

> Always pass `--provenance=false`. Without it the image is wrapped in an OCI image index, breaking config blob access in registry UIs.

---

## Docker Registry Notes

- **Delete requires** registry running with `REGISTRY_STORAGE_DELETE_ENABLED=true`
- **Delete uses digest**, not tag name — the `Docker-Content-Digest` response header from `getManifest` provides it
- **Pagination** is handled via `Link: <url>; rel="next"` header on `_catalog` and `tags/list`
- **Bearer token auth** flow: registry returns `401` with `Www-Authenticate: Bearer realm="...",service="...",scope="..."` → fetch token from realm URL (with Basic creds if needed) → retry with `Authorization: Bearer <token>`
- **Provenance attestations** from `docker/build-push-action@v6` wrap images in an OCI image index — set `provenance: false` in workflows to push plain v2 manifests
- **Config blob Accept header** must include `application/octet-stream` — using manifest content types for blob requests can cause 404 on some registry implementations
