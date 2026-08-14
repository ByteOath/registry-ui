import db from './db'
import { getCatalog, listTagsWithMeta, sortTagsByCreated, deleteManifest, type RegistryConfig } from './registry-client'
import { recordDeletion } from './deleted-log'
import { isProtected } from './tag-match'

interface RetentionRegistry {
  id: number
  name: string
  url: string
  username: string
  password: string
  retention_keep_last: number
  retention_protect: string
}

/** Validates the retention fields of a registry create/update payload. Returns null if invalid. */
export function parseRetention(keepLastRaw: unknown, protectRaw: unknown): { keepLast: number; protect: string } | null {
  const keepLast = Number(keepLastRaw ?? 0)
  if (!Number.isInteger(keepLast) || keepLast < 0 || keepLast > 10000) return null
  return { keepLast, protect: String(protectRaw ?? 'latest').slice(0, 500) }
}

export interface SweepResult {
  deleted: number
  errors: string[]
}

/**
 * Deletes every tag of every image ranked beyond `retention_keep_last` (newest build first),
 * skipping protected tags. Irreversible — each deletion is written to the deleted_tags log.
 */
export async function runRetentionForRegistry(registryId: number | string): Promise<SweepResult> {
  const reg = db.prepare(
    'SELECT id, name, url, username, password, retention_keep_last, retention_protect FROM registries WHERE id = ?'
  ).get(Number(registryId)) as unknown as RetentionRegistry | undefined

  const result: SweepResult = { deleted: 0, errors: [] }
  if (!reg) { result.errors.push('Registry not found'); return result }

  const keepLast = Number(reg.retention_keep_last) || 0
  if (keepLast <= 0) return result // retention off

  const protect = reg.retention_protect || 'latest'
  const config: RegistryConfig = {
    url: reg.url,
    username: reg.username || undefined,
    password: reg.password || undefined,
  }

  let repos: string[]
  try {
    repos = await getCatalog(config)
  } catch (e) {
    result.errors.push(`${reg.name}: catalog unreachable (${e instanceof Error ? e.message : 'error'})`)
    return result
  }

  for (const image of repos) {
    try {
      const metas = await listTagsWithMeta(config, image, true)
      const candidates = sortTagsByCreated(metas).filter(t => t.digest && !isProtected(t.tag, protect))
      const doomed = candidates.slice(keepLast)

      // Two tags on one digest are one manifest — delete it once, log both.
      const done = new Set<string>()
      for (const t of doomed) {
        const digest = t.digest as string
        try {
          if (!done.has(digest)) {
            await deleteManifest(config, image, digest)
            done.add(digest)
          }
          recordDeletion({ registryId: reg.id, image, tag: t.tag, digest, size: t.size, reason: 'retention' })
          result.deleted++
        } catch (e) {
          result.errors.push(`${image}:${t.tag} — ${e instanceof Error ? e.message : 'delete failed'}`)
        }
      }
    } catch (e) {
      result.errors.push(`${image}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }

  return result
}

/** Sweeps every registry that has retention enabled. Used by the background timer. */
export async function runRetentionAll(): Promise<void> {
  const rows = db.prepare('SELECT id, name FROM registries WHERE retention_keep_last > 0').all() as unknown as { id: number; name: string }[]
  for (const row of rows) {
    const { deleted, errors } = await runRetentionForRegistry(row.id)
    console.log(`[retention] ${row.name}: deleted ${deleted} tag(s)${errors.length ? `, ${errors.length} error(s)` : ''}`)
    for (const err of errors) console.warn(`[retention] ${err}`)
  }
}
