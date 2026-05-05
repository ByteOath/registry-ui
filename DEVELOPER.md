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
│   │   │   ├── delete/route.ts         DELETE — remove tag by manifest digest
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
│   │   │           ├── tag-detail-drawer.tsx   Lazy detail drawer (client)
│   │   │           ├── sort-select.tsx          Sort control (client)
│   │   │           └── delete-tag-button.tsx    Delete with confirm (client)
│   │   └── admin/
│   │       ├── registries/             Registry CRUD + connectivity test
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
    └── utils.ts                        cn, formatBytes, formatDate, formatRelativeDate, apiError
```

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
| `deleteManifest(config, name, digest)` | `DELETE /v2/{name}/manifests/{digest}` | Requires delete enabled on registry |

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
registries (id, name, url, username, password, environment, created_at)
users      (id, username, password_hash, role, created_at)
```

### `src/lib/auth.ts`

```ts
getSession()      // → SessionData — always safe to call, returns empty session if unauthenticated
requireAuth()     // → throws 'UNAUTHORIZED' if no session
requireAdmin()    // → throws 'UNAUTHORIZED' or 'FORBIDDEN' if not admin
```

Errors thrown by `requireAuth`/`requireAdmin` are caught by `apiError()` in `utils.ts` and returned as `401`/`403` JSON responses.

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
  created_at: string                      // ISO datetime
}
```

### Session

```ts
interface SessionUser {
  id: number
  username: string
  role: 'admin' | 'viewer'
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
| `DELETE` | `/api/registry/[id]/delete` | Admin | Delete tag by digest |
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

### 1. Update CHANGELOG.md

Add a new `## [x.y.z] - YYYY-MM-DD` section under `## [Unreleased]` following [Keep a Changelog](https://keepachangelog.com) format. Sections used: `Added`, `Changed`, `Fixed`.

### 2. Commit

Follow [Conventional Commits](https://www.conventionalcommits.org):

```bash
git add .
git commit -m "feat: description of change"
# or: fix: / docs: / chore: / refactor:
```

### 3. Tag the release

Use **annotated tags** — they carry a message, tagger identity, and date.

```bash
git tag -a v1.0.2 -m "Release v1.0.2"
git push origin main
git push origin v1.0.2
```

Tags trigger the GitHub Actions CI build (`.github/workflows/docker-publish.yml`). It:
- Builds multi-arch image (`linux/amd64` + `linux/arm64`)
- Pushes to Docker Hub:
  - `byteoath/registry-ui:1.0.2`
  - `byteoath/registry-ui:1.0`
  - `byteoath/registry-ui:latest`

### 4. Semver guide

| Change type | Version bump | Example |
|-------------|-------------|---------|
| Bug fix, docs, chore | Patch → `x.y.Z` | `1.0.1 → 1.0.2` |
| New feature, backward-compatible | Minor → `x.Y.0` | `1.0.2 → 1.1.0` |
| Breaking change | Major → `X.0.0` | `1.1.0 → 2.0.0` |

### 5. Required GitHub Secrets

Set once in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `DOCKERHUB_USERNAME` | `byteoath` |
| `DOCKERHUB_TOKEN` | Docker Hub token with **Read, Write, Delete** scope |

Generate token: [Docker Hub](https://hub.docker.com) → Account Settings → Personal access tokens → Generate new token.

> If CI fails with `401 Unauthorized` or `insufficient_scope`, regenerate the token with all three scopes and update the secret.

### Manual publish (no CI)

```bash
docker login   # enter byteoath credentials

docker buildx create --use --name multiarch
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --provenance=false \
  -t byteoath/registry-ui:1.0.2 \
  -t byteoath/registry-ui:latest \
  --push .
```

> Always set `--provenance=false` for manual builds. Without it, the image is wrapped in an OCI image index even for single-platform builds, which breaks config blob access in registry UIs.

---

## Docker Registry Notes

- **Delete requires** registry running with `REGISTRY_STORAGE_DELETE_ENABLED=true`
- **Delete uses digest**, not tag name — the `Docker-Content-Digest` response header from `getManifest` provides it
- **Pagination** is handled via `Link: <url>; rel="next"` header on `_catalog` and `tags/list`
- **Bearer token auth** flow: registry returns `401` with `Www-Authenticate: Bearer realm="...",service="...",scope="..."` → fetch token from realm URL (with Basic creds if needed) → retry with `Authorization: Bearer <token>`
- **Provenance attestations** from `docker/build-push-action@v6` wrap images in an OCI image index — set `provenance: false` in workflows to push plain v2 manifests
- **Config blob Accept header** must include `application/octet-stream` — using manifest content types for blob requests can cause 404 on some registry implementations
