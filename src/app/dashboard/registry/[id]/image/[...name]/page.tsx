import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getTags, getManifest, getImageConfig } from '@/lib/registry-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, ArrowLeft, Tag } from 'lucide-react'
import { formatBytes, formatRelativeDate } from '@/lib/utils'
import TagDetailDrawer from './tag-detail-drawer'
import DeleteTagButton from './delete-tag-button'
import SortSelect from './sort-select'

interface Registry {
  id: number; name: string; url: string; username: string; password: string
}

type SortKey = 'created' | 'name' | 'size'

export default async function ImagePage({ params, searchParams }: {
  params: Promise<{ id: string; name: string[] }>
  searchParams: Promise<{ sort?: string }>
}) {
  const session = await getSession()
  const { id, name } = await params
  const { sort: sortParam } = await searchParams
  const sort: SortKey = sortParam === 'name' || sortParam === 'size' ? sortParam : 'created'

  const imageName = name.join('/')

  const registry = db.prepare('SELECT * FROM registries WHERE id = ?').get(id) as unknown as Registry | undefined
  if (!registry) notFound()

  const config = { url: registry.url, username: registry.username || undefined, password: registry.password || undefined }

  let tags: string[] = []
  let error: string | null = null

  try {
    tags = await getTags(config, imageName)
  } catch (e) {
    error = String(e)
  }

  const tagManifests = await Promise.all(
    tags.map(async tag => {
      try {
        const manifest = await getManifest(config, imageName, tag)
        let created: string | null = null
        if (sort === 'created' && manifest.configDigest) {
          try {
            const cfg = await getImageConfig(config, imageName, manifest.configDigest)
            created = cfg.created
          } catch { /* best-effort */ }
        }
        return { tag, ...manifest, created }
      } catch {
        return { tag, digest: null, size: 0, layers: 0, mediaType: null, schemaVersion: null, configDigest: null, created: null }
      }
    })
  )

  // Sort
  const sorted = [...tagManifests].sort((a, b) => {
    if (sort === 'name') return a.tag.localeCompare(b.tag)
    if (sort === 'size') return (b.size ?? 0) - (a.size ?? 0)
    // created: newest first, nulls last, but keep 'latest' pinned to top
    if (a.tag === 'latest') return -1
    if (b.tag === 'latest') return 1
    if (!a.created && !b.created) return 0
    if (!a.created) return 1
    if (!b.created) return -1
    return new Date(b.created).getTime() - new Date(a.created).getTime()
  })

  const isAdmin = session.user?.role === 'admin'

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/dashboard/registry/${id}`} className="hover:text-foreground transition-colors">{registry.name}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium font-mono">{imageName}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-mono">{imageName}</h1>
          <p className="text-sm text-muted-foreground mt-1">{registry.name} · {registry.url}</p>
        </div>
        <Badge variant="outline" className="shrink-0">{tags.length} tags</Badge>
      </div>

      {error ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-destructive">{error}</p></CardContent></Card>
      ) : tags.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No tags found.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Sort by</span>
            <Suspense><SortSelect value={sort} /></Suspense>
          </div>

          <div className="space-y-1">
            {sorted.map(({ tag, digest, size, layers, mediaType, created }) => {
              const isLatest = tag === 'latest'
              return (
                <div
                  key={tag}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg border bg-card ${isLatest ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Tag className={`h-4 w-4 shrink-0 ${isLatest ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono font-medium ${isLatest ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{tag}</span>
                        {isLatest && (
                          <Badge className="text-[10px] h-4 px-1.5 bg-emerald-500 hover:bg-emerald-500 text-white">latest</Badge>
                        )}
                      </div>
                      {digest && (
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5" title={digest}>
                          {digest.slice(0, 19)}…
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {mediaType && (
                          <span className="text-[10px] text-muted-foreground/60 font-mono hidden sm:inline">
                            {mediaType.split('.').pop()}
                          </span>
                        )}
                        {sort === 'created' && created && (
                          <span className="text-[11px] text-muted-foreground">{formatRelativeDate(created)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    {size != null && size > 0 && (
                      <span className="text-xs text-muted-foreground">{formatBytes(size)}</span>
                    )}
                    {layers > 0 && (
                      <span className="text-xs text-muted-foreground">{layers}L</span>
                    )}
                    <TagDetailDrawer registryId={id} imageName={imageName} tag={tag} />
                    {isAdmin && digest && (
                      <DeleteTagButton registryId={id} imageName={imageName} tag={tag} digest={digest} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
