import db from './db'

export interface DeletionRecord {
  registryId: number | string
  image: string
  tag: string
  digest: string
  size?: number
  reason: 'manual' | 'retention'
  deletedBy?: string
}

/** Single write point for the deleted-tags audit log — manual deletes, bulk deletes and sweeps. */
export function recordDeletion(r: DeletionRecord): void {
  db.prepare(
    'INSERT INTO deleted_tags (registry_id, image, tag, digest, size, reason, deleted_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(Number(r.registryId), r.image, r.tag, r.digest, r.size ?? 0, r.reason, r.deletedBy ?? '')
}
