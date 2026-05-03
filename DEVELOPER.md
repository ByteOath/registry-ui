# Developer Guide

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) |
| Database | SQLite via `better-sqlite3` |
| Auth | `iron-session` (encrypted cookie) |
| UI | shadcn/ui + Tailwind CSS |
| Runtime | Node.js 20 Alpine (standalone output) |

## Local Dev

```bash
cp .env.example .env.local
# edit .env.local — set ADMIN_USERNAME, ADMIN_PASSWORD, APP_SECRET

npm install
npm run dev
# → http://localhost:3000
```

SQLite DB created at `./data/registry-ui.db` on first run.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ADMIN_USERNAME` | Master admin seeded on first run (default: `admin`) |
| `ADMIN_PASSWORD` | Master admin password (default: `admin`) |
| `APP_SECRET` | Session encryption key — must be 32+ chars — `openssl rand -hex 32` |
| `DB_PATH` | SQLite path (default: `./data/registry-ui.db`, Docker: `/data/registry-ui.db`) |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/               login, logout, me
│   │   ├── registries/         CRUD for connected registries
│   │   └── registry/[id]/      proxy to Docker Registry v2 API (delete)
│   ├── dashboard/
│   │   ├── page.tsx            registry cards grid
│   │   ├── registry/[id]/      image list (searchable)
│   │   │   └── image/[...name] tag list + delete
│   │   └── admin/
│   │       ├── registries/     manage registries
│   │       └── users/          manage users + roles
│   └── login/
├── components/
│   ├── sidebar.tsx
│   ├── search-filter.tsx
│   └── ui/                     shadcn components
└── lib/
    ├── db.ts                   SQLite singleton, auto-migrate, admin seed
    ├── auth.ts                 iron-session helpers (getSession, requireAuth, requireAdmin)
    ├── registry-client.ts      Docker Registry v2 API client (basic + bearer token auth)
    └── utils.ts
```

## Key Files

- **`src/lib/db.ts`** — singleton PDO-like DB, runs migrations and seeds admin on boot
- **`src/lib/auth.ts`** — `requireAuth()` and `requireAdmin()` throw `UNAUTHORIZED`/`FORBIDDEN` — caught by `apiError()` in utils
- **`src/lib/registry-client.ts`** — handles pagination (`Link` header), bearer token challenge/retry, and manifest v2 for image sizes

## Docker Build

```bash
# Build
docker build -t registry-ui:dev .

# Run
docker run -p 3000:3000 \
  -v registry-ui-data:/data \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin \
  -e APP_SECRET=$(openssl rand -hex 32) \
  registry-ui:dev

# Or with compose
docker compose up --build
```

## Publish to Docker Hub

```bash
# Tag and push manually
docker build \
  -t byteoath/registry-ui:1.0.0 \
  -t byteoath/registry-ui:latest .

docker push byteoath/registry-ui:1.0.0
docker push byteoath/registry-ui:latest
```

Once GitHub is connected, pushing a version tag triggers CI automatically:

```bash
git tag v1.0.0
git push --tags
# GitHub Actions builds multi-arch (amd64 + arm64) and pushes to Docker Hub
```

CI workflow: `.github/workflows/docker-publish.yml`
Required GitHub secrets: `DOCKERHUB_USERNAME=byteoath`, `DOCKERHUB_TOKEN`

## Docker Registry Notes

- Image deletion requires registry running with `REGISTRY_STORAGE_DELETE_ENABLED=true`
- Delete uses manifest digest (`Docker-Content-Digest` header), not tag name
- Pagination handled via `Link: <url>; rel="next"` header on `/v2/_catalog` and `/v2/{name}/tags/list`
- Bearer token auth: registry returns `401` with `Www-Authenticate` → fetch token from realm URL → retry
