import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getCatalog } from '@/lib/registry-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, Container, ArrowLeft } from 'lucide-react'
import SearchFilter from '@/components/search-filter'

interface Registry {
  id: number; name: string; url: string; username: string; password: string
}

export default async function RegistryPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}) {
  await getSession()
  const { id } = await params
  const { q } = await searchParams

  const registry = db.prepare('SELECT * FROM registries WHERE id = ?').get(id) as unknown as Registry | undefined
  if (!registry) notFound()

  let repos: string[] = []
  let error: string | null = null

  try {
    repos = await getCatalog({
      url: registry.url,
      username: registry.username || undefined,
      password: registry.password || undefined,
    })
  } catch (e) {
    error = String(e)
  }

  const filtered = q ? repos.filter(r => r.toLowerCase().includes(q.toLowerCase())) : repos

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{registry.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{registry.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{registry.url}</p>
        </div>
        <Badge variant="outline">{repos.length} images</Badge>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Suspense><SearchFilter placeholder="Search images…" /></Suspense>
          <div className="space-y-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No images found.</p>
            ) : (
              filtered.map(repo => (
                <Link
                  key={repo}
                  href={`/dashboard/registry/${id}/image/${repo}`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Container className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-mono">{repo}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
