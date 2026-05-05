import { notFound } from 'next/navigation'
import Link from 'next/link'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getManifest, getImageConfig } from '@/lib/registry-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'

interface Registry {
  id: number; name: string; url: string; username: string; password: string
}

export default async function TagDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ image?: string; tag?: string }>
}) {
  await getSession()
  const { id } = await params
  const { image: imageName, tag } = await searchParams

  if (!imageName || !tag) notFound()

  const registry = db
    .prepare('SELECT * FROM registries WHERE id = ?')
    .get(id) as unknown as Registry | undefined
  if (!registry) notFound()

  const config = {
    url: registry.url,
    username: registry.username || undefined,
    password: registry.password || undefined,
  }

  let manifest: Awaited<ReturnType<typeof getManifest>>
  try {
    manifest = await getManifest(config, imageName, tag)
  } catch (e) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-destructive">{String(e)}</p>
      </div>
    )
  }

  let imageConfig = null
  if (manifest.configDigest) {
    try {
      imageConfig = await getImageConfig(config, imageName, manifest.configDigest)
    } catch {
      /* best-effort */
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/dashboard/registry/${id}`} className="hover:text-foreground transition-colors">
          {registry.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/dashboard/registry/${id}/image/${imageName}`}
          className="hover:text-foreground transition-colors font-mono"
        >
          {imageName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium font-mono">{tag}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-mono">
            {imageName}<span className="text-muted-foreground">:{tag}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{registry.name} · {registry.url}</p>
        </div>
        {imageConfig?.architecture && imageConfig?.os && (
          <Badge variant="secondary" className="shrink-0">
            {imageConfig.architecture}/{imageConfig.os}
          </Badge>
        )}
      </div>

      <Separator />

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <MetaRow label="Digest" value={manifest.digest} mono />
          <MetaRow label="Media Type" value={manifest.mediaType} mono />
          <MetaRow label="Schema Version" value={manifest.schemaVersion != null ? String(manifest.schemaVersion) : null} />
          <MetaRow label="Size" value={manifest.size ? formatBytes(manifest.size) : null} />
          <MetaRow label="Layers" value={String(manifest.layers)} />
          {imageConfig?.created && <MetaRow label="Created" value={formatDate(imageConfig.created)} />}
          {imageConfig?.author && <MetaRow label="Author" value={imageConfig.author} />}
        </CardContent>
      </Card>

      {/* Container Config */}
      {imageConfig && (imageConfig.workingDir || (imageConfig.entrypoint && imageConfig.entrypoint.length > 0) || (imageConfig.cmd && imageConfig.cmd.length > 0) || (imageConfig.exposedPorts && imageConfig.exposedPorts.length > 0)) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Container Config
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {imageConfig.workingDir && <MetaRow label="Working Dir" value={imageConfig.workingDir} mono />}
            {imageConfig.entrypoint && imageConfig.entrypoint.length > 0 && (
              <MetaRow label="Entrypoint" value={imageConfig.entrypoint.join(' ')} mono />
            )}
            {imageConfig.cmd && imageConfig.cmd.length > 0 && (
              <MetaRow label="CMD" value={imageConfig.cmd.join(' ')} mono />
            )}
            {imageConfig.exposedPorts && imageConfig.exposedPorts.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Exposed Ports</span>
                <div className="flex flex-wrap gap-1.5">
                  {imageConfig.exposedPorts.map(p => (
                    <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Environment Variables */}
      {imageConfig?.env && imageConfig.env.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Environment Variables
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-b-lg overflow-hidden">
              {imageConfig.env.map((envVar, i) => {
                const eqIdx = envVar.indexOf('=')
                const key = eqIdx !== -1 ? envVar.slice(0, eqIdx) : envVar
                const val = eqIdx !== -1 ? envVar.slice(eqIdx + 1) : ''
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_2fr] gap-4 px-6 py-2 text-xs font-mono border-b last:border-0 odd:bg-muted/20"
                  >
                    <span className="text-foreground font-semibold truncate">{key}</span>
                    <span className="text-muted-foreground break-all">{val}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Labels */}
      {imageConfig?.labels && Object.keys(imageConfig.labels).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Labels
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-b-lg overflow-hidden">
              {Object.entries(imageConfig.labels).map(([k, v], i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_2fr] gap-4 px-6 py-2 text-xs font-mono border-b last:border-0 odd:bg-muted/20"
                >
                  <span className="text-foreground truncate">{k}</span>
                  <span className="text-muted-foreground break-all">{v}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Build History */}
      {imageConfig?.history && imageConfig.history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Build History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {imageConfig.history.map((h, i) => (
                <div key={i} className="px-6 py-3 flex items-start gap-4 text-xs">
                  <span className="text-muted-foreground/50 tabular-nums w-5 shrink-0 pt-0.5">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-mono text-foreground/80 whitespace-pre-wrap break-all leading-relaxed">
                      {h.created_by || '<no command>'}
                    </p>
                    <div className="flex items-center gap-3">
                      {h.created && (
                        <span className="text-muted-foreground">{formatDate(h.created)}</span>
                      )}
                      {h.empty_layer && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">empty layer</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-xs break-all' : 'text-sm'}>{value}</span>
    </div>
  )
}
