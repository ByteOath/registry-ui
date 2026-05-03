import { notFound } from 'next/navigation'
import Link from 'next/link'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getTags, getManifest } from '@/lib/registry-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, ArrowLeft, Tag } from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import DeleteTagButton from './delete-tag-button'

interface Registry {
  id: number; name: string; url: string; username: string; password: string
}

export default async function ImagePage({ params }: {
  params: Promise<{ id: string; name: string[] }>
}) {
  const session = await getSession()
  const { id, name } = await params
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
        return { tag, ...manifest }
      } catch {
        return { tag, digest: null, size: 0, layers: 0 }
      }
    })
  )

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

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold font-mono">{imageName}</h1>
          <p className="text-sm text-muted-foreground mt-1">{registry.name} · {registry.url}</p>
        </div>
        <Badge variant="outline">{tags.length} tags</Badge>
      </div>

      {error ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-destructive">{error}</p></CardContent></Card>
      ) : tags.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No tags found.</p>
      ) : (
        <div className="space-y-1">
          {tagManifests.map(({ tag, digest, size, layers }) => (
            <div key={tag} className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3 min-w-0">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-mono font-medium">{tag}</span>
                  {digest && (
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5" title={digest}>
                      {digest.slice(0, 19)}…
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 ml-4 shrink-0">
                {size != null && size > 0 && (
                  <span className="text-xs text-muted-foreground">{formatBytes(size)}</span>
                )}
                {layers > 0 && (
                  <span className="text-xs text-muted-foreground">{layers}L</span>
                )}
                {isAdmin && digest && (
                  <DeleteTagButton registryId={id} imageName={imageName} tag={tag} digest={digest} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
