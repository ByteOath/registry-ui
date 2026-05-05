# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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

[Unreleased]: https://github.com/byteoath/registry-ui/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/byteoath/registry-ui/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/byteoath/registry-ui/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/byteoath/registry-ui/releases/tag/v1.0.0
