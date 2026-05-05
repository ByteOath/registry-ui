# Registry UI

A minimal, self-hosted Docker Registry browser. Connect multiple registries, browse images, inspect tag details — all from one clean interface.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Docker](https://img.shields.io/badge/Docker-byteoath%2Fregistry--ui-blue?logo=docker)
![License](https://img.shields.io/badge/license-MIT-green)

## Screenshots

### Dashboard — List View
![Dashboard List View](assets/1.png)

### Dashboard — Card View
![Dashboard Card View](assets/2.png)

### Admin — Registries
![Admin Registries](assets/3.png)

### Edit Registry with Connectivity Check
![Edit Registry](assets/5.png)

### Admin — Users
![Admin Users](assets/4.png)

### Registry Browser
![Registry Browser](assets/6.png)

---

## Features

- **Multi-registry** — connect and manage multiple Docker registries (with or without auth)
- **Browse** — search images, list tags with size, digest, and manifest type
- **Tag counts** — see how many tags each image has directly from the registry list
- **Tag details drawer** — click any tag to inspect full metadata in a side panel:
  - Architecture & OS
  - Created date
  - Container config (working dir, entrypoint, cmd, exposed ports)
  - Environment variables
  - Image labels
  - Build history (layer-by-layer commands)
- **Sort tags** — by created date (default), name, or size
- **Latest badge** — `latest` tag is always visually highlighted and pinned to the top
- **Delete** — remove image tags by digest directly from the UI (admin only)
- **Auth** — session-based login with encrypted cookies
- **Role management** — admin and viewer roles, managed from the UI
- **Single container** — one Docker image, SQLite database, no external dependencies

## Quick Start

```bash
docker run -d \
  -p 3000:3000 \
  -v registry-ui-data:/data \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=changeme \
  -e APP_SECRET=$(openssl rand -hex 32) \
  byteoath/registry-ui:latest
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## Docker Compose

```yaml
services:
  app:
    image: byteoath/registry-ui:latest
    ports:
      - "3000:3000"
    volumes:
      - registry-ui-data:/data
    environment:
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD: changeme
      APP_SECRET: your-random-secret-here
    restart: unless-stopped

volumes:
  registry-ui-data:
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_USERNAME` | No | `admin` | Master admin username (seeded on first run) |
| `ADMIN_PASSWORD` | No | `admin` | Master admin password |
| `APP_SECRET` | **Yes** | — | Session encryption secret — use `openssl rand -hex 32` |
| `DB_PATH` | No | `/data/registry-ui.db` | SQLite database path |

> **Note:** `ADMIN_USERNAME` / `ADMIN_PASSWORD` only seed the initial admin. Change the password from the UI after first login.

## Connecting a Registry

1. Sign in as admin
2. Go to **Admin → Registries**
3. Click **Add Registry**
4. Enter name, URL, and optional credentials

Supports:
- Unauthenticated registries (`http://registry:5000`)
- Basic auth registries
- Bearer/token auth registries (e.g. Harbor, GitLab Registry)

> To enable image deletion, start your registry with `REGISTRY_STORAGE_DELETE_ENABLED=true`.

## Registry Compatibility

| Registry | Browse | Tag Details | Delete |
|----------|--------|-------------|--------|
| Docker Distribution (`registry:2`) | ✅ | ✅ | ✅ (if delete enabled) |
| Harbor | ✅ | ✅ | ✅ |
| GitLab Registry | ✅ | ✅ | ✅ |
| Nexus | ✅ | ✅ | ✅ |

> **Note for `docker/build-push-action@v6` users:** Set `provenance: false` in your GitHub Actions workflow. Without it, images are pushed as OCI image indexes (manifest lists) which do not expose a config blob — tag details like arch, OS, labels and history will be unavailable.

## User Roles

| Role | Browse | Delete images | Manage users | Manage registries |
|------|--------|---------------|--------------|-------------------|
| viewer | ✅ | ❌ | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ |

Add users at **Admin → Users**.

## Tech Stack

- [Next.js 15](https://nextjs.org) — fullstack React framework (App Router, React Server Components)
- [node:sqlite](https://nodejs.org/api/sqlite.html) — embedded database (Node.js built-in, no ORM)
- [iron-session](https://github.com/vvo/iron-session) — AES-encrypted cookie sessions
- [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS](https://tailwindcss.com) — UI components
- Docker Registry V2 API — all image data fetched live, nothing cached

## License

MIT
