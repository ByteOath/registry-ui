import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'
import { listTagsWithMeta, sortTagsByCreated, type TagMeta } from '@/lib/registry-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import TagList from './tag-list'
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

  let tagManifests: TagMeta[] = []
  let error: string | null = null

  try {
    tagManifests = await listTagsWithMeta(config, imageName, sort === 'created')
  } catch (e) {
    error = String(e)
  }

  const sorted = sort === 'created'
    ? sortTagsByCreated(tagManifests)
    : [...tagManifests].sort((a, b) =>
        sort === 'name' ? a.tag.localeCompare(b.tag) : (b.size ?? 0) - (a.size ?? 0))

  const isAdmin = session.user?.role === 'admin' || session.user?.role === 'super_admin'

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
        <Badge variant="outline" className="shrink-0">{tagManifests.length} tags</Badge>
      </div>

      {error ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-destructive">{error}</p></CardContent></Card>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No tags found.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Sort by</span>
            <Suspense><SortSelect value={sort} /></Suspense>
          </div>

          <TagList
            registryId={id}
            imageName={imageName}
            tags={sorted.map(({ tag, digest, size, layers, mediaType, created }) => ({ tag, digest, size, layers, mediaType, created }))}
            isAdmin={isAdmin}
            showCreated={sort === 'created'}
          />
        </>
      )}
    </div>
  )
}
