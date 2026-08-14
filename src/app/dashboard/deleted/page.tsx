import Link from 'next/link'
import { Suspense } from 'react'
import db from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, AlertTriangle, Timer, User } from 'lucide-react'
import { formatBytes, formatRelativeDate, toPlain } from '@/lib/utils'
import DeletedFilter from './deleted-filter'

interface DeletedRow {
  id: number
  registry_id: number
  registry_name: string | null
  image: string
  tag: string
  digest: string
  size: number
  reason: string
  deleted_by: string
  deleted_at: string
}

// ponytail: LIMIT 200, no paging. Add paging when the log outgrows one screen.
const LIMIT = 200

export default async function DeletedPage({ searchParams }: {
  searchParams: Promise<{ registry?: string; q?: string }>
}) {
  const { registry, q } = await searchParams

  const where: string[] = []
  const args: (string | number)[] = []
  if (registry && Number.isFinite(Number(registry))) { where.push('d.registry_id = ?'); args.push(Number(registry)) }
  if (q) { where.push('(d.image LIKE ? OR d.tag LIKE ?)'); args.push(`%${q}%`, `%${q}%`) }

  const rows = toPlain<DeletedRow[]>(
    db.prepare(`
      SELECT d.*, r.name AS registry_name
      FROM deleted_tags d
      LEFT JOIN registries r ON r.id = d.registry_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY d.deleted_at DESC
      LIMIT ${LIMIT}
    `).all(...args)
  )

  const registries = toPlain<{ id: number; name: string }[]>(
    db.prepare('SELECT id, name FROM registries ORDER BY name').all()
  )

  const reclaimable = rows.reduce((sum, r) => sum + (r.size || 0), 0)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Deleted tags</h1>
          <p className="text-sm text-muted-foreground mt-1">
            History of tags removed from a registry — by hand or by automatic cleanup.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">{rows.length} entries</Badge>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          This is a log, not a recycle bin. Deleted tags cannot be restored — push the image again to
          bring one back. Disk space is only reclaimed when the registry runs its garbage collector.
        </p>
      </div>

      <Suspense><DeletedFilter registries={registries} registry={registry ?? ''} q={q ?? ''} /></Suspense>

      {rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <Trash2 className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No deleted tags recorded.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="space-y-1">
            {rows.map(row => (
              <div key={row.id} className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3 min-w-0">
                  <Trash2 className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/dashboard/registry/${row.registry_id}/image/${row.image}`}
                        className="text-sm font-mono font-medium hover:underline truncate"
                      >
                        {row.image}:{row.tag}
                      </Link>
                      {row.reason === 'retention' ? (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1"><Timer className="h-2.5 w-2.5" />auto</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1"><User className="h-2.5 w-2.5" />manual</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5" title={row.digest}>
                      {row.digest.slice(0, 19)}…
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {row.registry_name ?? `registry #${row.registry_id} (removed)`}
                      {row.deleted_by ? ` · by ${row.deleted_by}` : ' · automatic sweep'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {row.size > 0 && <span className="text-xs text-muted-foreground">{formatBytes(row.size)}</span>}
                  <span className="text-xs text-muted-foreground" title={row.deleted_at}>
                    {formatRelativeDate(row.deleted_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {reclaimable > 0 && <>{formatBytes(reclaimable)} freed on the next garbage collect · </>}
            showing the {LIMIT} most recent entries
          </p>
        </>
      )}
    </div>
  )
}
