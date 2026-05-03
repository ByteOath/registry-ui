# Developer Guide

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) |
| Database | SQLite via `node:sqlite` (Node.js built-in) |
| Auth | `iron-session` (encrypted cookie) |
| UI | shadcn/ui + Tailwind CSS |
| Runtime | Node.js 22 Alpine (standalone output) |

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

## Release Process

### 1. Commit and push code

```bash
git add .
git commit -m "feat: your change"
git push origin main
```

### 2. Tag the release

Tags trigger the GitHub Actions CI build. Use [semver](https://semver.org) with a `v` prefix.

```bash
git tag v1.0.0
git push origin v1.0.0
```

CI runs at `.github/workflows/docker-publish.yml`. It:
- Builds multi-arch image (`linux/amd64` + `linux/arm64`)
- Pushes three tags to Docker Hub:
  - `byteoath/registry-ui:1.0.0`
  - `byteoath/registry-ui:1.0`
  - `byteoath/registry-ui:latest`

### 3. Subsequent releases

Bump the version in each new release. Follow [semver](https://semver.org):
- Bug fix → `v1.0.1`
- New feature → `v1.1.0`
- Breaking change → `v2.0.0`

```bash
# make changes, then:
git add .
git commit -m "fix: description of change"
git push origin main

git tag v1.0.1
git push origin v1.0.1
```

Each new tag triggers a fresh CI build and updates `latest` on Docker Hub automatically.

### 4. Required GitHub secrets

Set these **once** in **GitHub → repo → Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `DOCKERHUB_USERNAME` | `byteoath` |
| `DOCKERHUB_TOKEN` | Docker Hub access token — **must have Read, Write, Delete scope** |

Generate token: [Docker Hub](https://hub.docker.com) → **Account Settings → Personal access tokens → Generate new token** → select **Read, Write, Delete**.

> If CI fails with `401 Unauthorized` or `insufficient scopes`, regenerate the token with all three scopes and update the GitHub secret.

---

### Manual publish (no CI)

If GitHub Actions is not set up yet, push directly:

```bash
docker login   # enter byteoath credentials

docker build \
  -t byteoath/registry-ui:1.0.0 \
  -t byteoath/registry-ui:latest .

docker push byteoath/registry-ui:1.0.0
docker push byteoath/registry-ui:latest
```

For multi-arch on Apple Silicon (M-series):

```bash
docker buildx create --use --name multiarch
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t byteoath/registry-ui:1.0.0 \
  -t byteoath/registry-ui:latest \
  --push .
```

## Docker Registry Notes

- Image deletion requires registry running with `REGISTRY_STORAGE_DELETE_ENABLED=true`
- Delete uses manifest digest (`Docker-Content-Digest` header), not tag name
- Pagination handled via `Link: <url>; rel="next"` header on `/v2/_catalog` and `/v2/{name}/tags/list`
- Bearer token auth: registry returns `401` with `Www-Authenticate` → fetch token from realm URL → retry
