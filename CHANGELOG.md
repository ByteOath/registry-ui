# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Built-in manual** — `/dashboard/docs` ("Manual" in the sidebar): what the app does, connecting a registry, copy-pasteable `docker login` / `build` / `push` commands using your own registry host, roles, deletion, cleanup, and a FAQ
- **Bulk tag delete** — checkboxes on the tag list plus a "Delete selected" action; tags sharing a digest are deleted once and logged individually; batches capped at 100 tags
- **Automatic tag cleanup (retention)** — per-registry "keep last N tags per image" with protected tag patterns (`latest, v*, prod-*`); background sweep every `RETENTION_INTERVAL_HOURS` (24 by default, never at start-up), disabled with `RETENTION_AUTO=false`, plus a "Run cleanup now" action per registry
- **Deleted tags page** — `/dashboard/deleted` audit log of every removed tag with registry, digest, size, reason (`manual` / `auto`), who deleted it and when; filterable by registry and image
- **`POST /api/registry/[id]/retention/run`** — admin-only manual retention sweep for one registry
- **`deleted_tags` table** and `registries.retention_keep_last` / `registries.retention_protect` columns, both added by in-place migration for existing databases
- **`npm test`** — `node --test` unit tests for retention tag-pattern matching (`src/lib/tag-match.ts`)
- `RETENTION_AUTO` and `RETENTION_INTERVAL_HOURS` environment variables

### Changed

- **`apiError`** now forwards the message of a `PublicError` (a new error class for operator-actionable failures) with its status code; every other error still returns `"Internal server error"` with no detail
- `DELETE /api/registry/[id]/delete` accepts `{ name, tags: [...] }` for bulk deletion alongside the existing `{ name, digest }` shape, and records every deletion in the audit log
- Tag enrichment moved into a shared `listTagsWithMeta` helper in `src/lib/registry-client.ts`, used by both the image page and the retention sweep
- README documents deletion, automatic cleanup and the FAQ; the roles table now lists `super_admin`

### Fixed

- Failed tag deletion showed **"Internal server error"** instead of the real cause — a registry without deletion enabled now reports `Delete not enabled on registry (set REGISTRY_STORAGE_DELETE_ENABLED=true)` (HTTP 409), and other registry failures report their status
- Removed dead `WifiOff` and `Container` icon imports from the registries admin client

---

## [1.0.3] - 2026-05-08

### Added

- **Three-role system** — `super_admin`, `admin`, and `viewer` roles replace the previous two-role system
  - `super_admin` is the bootstrap user seeded from `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars; cannot be created or deleted via the UI
  - `admin` can manage registries, delete image tags, create and delete `viewer` users
  - `viewer` has read-only access
- **Role picker** — inline Admin / Viewer toggle buttons in the Add User dialog (replaces dropdown, avoids z-index issues inside dialogs)
- **`.dockerignore`** — excludes `.env.local` and `.env*.local` from Docker build context so Dokploy-injected environment variables are used at runtime instead of baked-in local values
- **Login rate limiting** — max 10 attempts per 15 minutes per IP address; returns HTTP 429 on breach

### Changed

- **`ADMIN_PASSWORD` sync on startup** — if `ADMIN_PASSWORD` env var is explicitly set and differs from the stored hash, the `super_admin` password is updated automatically on boot; Dokploy env var changes now take effect on next redeploy without wiping the database volume
- **`sessionOptions` lazy evaluation** — `APP_SECRET` is now read at request time instead of module init, ensuring runtime env vars are always used
- **`apiError`** no longer leaks internal error messages or stack traces to clients; all unexpected errors return `"Internal server error"` and log to the server console
- **Test connection** — wrong credentials now show a red **"Authentication failed — check username and password"** message instead of a misleading green "Connected — 0 images found"
- **Select dropdown z-index** raised to `z-[201]` so Radix UI select menus render above dialogs (`z-[200]`)

### Fixed

- `super_admin` users are correctly stored and restored from session — the login route previously cast role to `'admin' | 'viewer'`, which would cause TypeScript errors for the new role
- DB migration on first boot with existing database: users table is recreated with the updated `CHECK(role IN ('super_admin','admin','viewer'))` constraint and the seeded admin is promoted to `super_admin`
- Registry URL validated as `http` or `https` before saving, preventing SSRF via `file://` or other schemes
- `image` and `tag` query params validated with regex before proxying to registry API
- Manifest `digest` validated as `sha256:[a-f0-9]{64}` before delete
- User `id` path param validated as a positive integer
- Startup warnings emitted if `APP_SECRET` or `ADMIN_PASSWORD` env vars are not set

---

## [1.0.2] - 2026-05-06

### Added

- **Tag detail drawer** — click "Details" on any tag to open a right-side drawer with full image metadata without leaving the page
  - Architecture & OS (e.g. `amd64/linux`)
  - Created date
  - Container config: working dir, entrypoint, CMD, exposed ports
  - Environment variables (key/value table)
  - Image labels (key/value table)
  - Build history with per-layer commands and dates
- **Sort tags** — segmented sort control on the tag list page: Created Date (default), Name, Size
- **Latest tag badge** — `latest` tag is visually highlighted with an emerald badge, coloured border, and always pinned to the top when sorting by created date
- **Tag count per image** — the registry images list now shows the number of tags for each repository
- **`Sheet` UI component** — right-side drawer built on Radix UI Dialog (`src/components/ui/sheet.tsx`)
- **Tag detail API route** — `GET /api/registry/[id]/tag-detail?image=&tag=` — server-side proxy that fetches manifest and config blob for a single tag on demand
- **Standalone tag detail page** — accessible at `/dashboard/registry/[id]/tag?image=&tag=` for direct URL access to full tag metadata
- **Bruno API collection** — `bruno/` directory with pre-built requests for all Docker Registry V2 endpoints, with a `Local` environment template

### Changed

- **Lazy config loading** — image config blob (arch, OS, labels, env, history) is now fetched only when the detail drawer is opened, not on page load. Reduces N+1 API calls on the tag list page
- **Config blob `Accept` header** — blob requests now use `application/octet-stream, application/json, */*` instead of manifest content types, fixing silent 404s on strict registry implementations
- **Manifest `Accept` header** — added `application/vnd.docker.distribution.manifest.list.v2+json` and `application/vnd.oci.image.index.v1+json` to accept manifest lists and OCI indexes
- **`getManifest()`** now returns `configDigest` — the digest of the image config blob, used to fetch architecture, OS, and container metadata
- **`formatRelativeDate()`** added to `src/lib/utils.ts` — returns human-friendly relative dates (e.g. `3d ago`, `2mo ago`)
- **DEVELOPER.md** — comprehensive rewrite with architecture diagram, request flow traces, data models, full API route reference, registry client function table, manifest type compatibility matrix, Bruno collection guide
- **README.md** — updated features list, registry compatibility table, and note on `provenance: false` for GitHub Actions users

### Fixed

- Tags with `manifest.list.v2+json` or `oci.image.index.v1+json` media type no longer return 404 on the tag detail page — correct `Accept` header is now sent
- Config blob fetch no longer silently fails on registries that reject manifest-type `Accept` headers for blob endpoints
- Drawer gracefully handles manifest list and legacy v1 manifest types with a descriptive inline message instead of an empty panel

---

## [1.0.1] - 2026-05-03

### Fixed

- SQLite database path now correctly defaults to `/data/registry-ui.db` in production environments (Docker) and `./data/registry-ui.db` in development — previously always used the relative path, causing the DB to be created outside the mounted volume in production

### Changed

- Developer documentation updated with release process, semver guide, and Docker Hub token requirements (Read + Write + Delete scope)

---

## [1.0.0] - 2026-05-03

### Added

- Initial release
- **Multi-registry dashboard** — connect and manage multiple Docker registries from a single interface, with list and card views
- **Environment badges** — colour-coded production / staging / local labels per registry
- **Online status** — live connectivity check for each registry
- **Registry browser** — searchable image list per registry, with tag count
- **Tag list** — browse all tags for an image with size, digest, and layer count
- **Tag delete** — remove image tags by manifest digest (admin only, requires `REGISTRY_STORAGE_DELETE_ENABLED=true`)
- **Docker Registry V2 client** — supports Basic auth, Bearer token auth, pagination, and manifest v2 for image sizes
- **Authentication** — session-based login with AES-encrypted iron-session cookies
- **Role system** — `admin` (full access) and `viewer` (read-only) roles
- **User management** — create, edit, delete users and assign roles (admin only)
- **Admin panel** — manage registries and users from dedicated admin pages
- **Theme** — light / dark mode toggle
- **Single container deployment** — Next.js standalone output, SQLite database, no external dependencies

---

[Unreleased]: https://github.com/byteoath/registry-ui/compare/v1.0.3...HEAD
[1.0.3]: https://github.com/byteoath/registry-ui/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/byteoath/registry-ui/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/byteoath/registry-ui/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/byteoath/registry-ui/releases/tag/v1.0.0
