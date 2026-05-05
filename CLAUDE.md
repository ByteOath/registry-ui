# Claude Code Rules — registry-ui

## Release & Tagging Rule (STRICT)

**Never push a git tag without completing every step below in order. No exceptions.**

### Mandatory checklist before any `git tag`

- [ ] 1. All code changes are committed and pushed to `main`
- [ ] 2. `npm run build` passes with zero errors
- [ ] 3. `CHANGELOG.md` updated — move items from `[Unreleased]` into a new `## [x.y.z] - YYYY-MM-DD` section with correct **Added / Changed / Fixed** labels
- [ ] 4. `README.md` updated if any user-facing feature was added or changed
- [ ] 5. `DEVELOPER.md` updated if any architecture, API, data model, or tooling changed
- [ ] 6. Docs committed in the same commit as the code, or in a dedicated `docs:` commit before tagging
- [ ] 7. Use an **annotated** tag — never a lightweight tag:
  ```bash
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  git push origin main
  git push origin vX.Y.Z
  ```
- [ ] 8. Create a **GitHub Release** via `gh release create` immediately after pushing the tag:
  - Title: `vX.Y.Z — Short description`
  - Body: human-readable release notes (not raw commit log)
  - Mark as `--latest` only on the highest version
  - Include a "Full changelog" link: `https://github.com/ByteOath/registry-ui/compare/vPREV...vX.Y.Z`

### Version bump rules (SemVer)

| Type of change | Bump | Example |
|----------------|------|---------|
| Bug fix, docs, chore | Patch `x.y.Z` | `1.0.2 → 1.0.3` |
| New feature, backward-compatible | Minor `x.Y.0` | `1.0.3 → 1.1.0` |
| Breaking change | Major `X.0.0` | `1.1.0 → 2.0.0` |

### CHANGELOG format (Keep a Changelog)

```markdown
## [Unreleased]        ← always present, always empty between releases

## [1.0.3] - 2026-06-01

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

Only these section labels are used: `Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`.

---

## General Rules

- Run `npm run build` before every commit that touches `src/`
- Never use `git add -A` or `git add .` without reviewing `git status` first
- Never amend or force-push `main`
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
