"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowUpRight } from "lucide-react"
import type { ImageConfig } from "@/lib/registry-client"
import { formatBytes, formatDate } from "@/lib/utils"

interface TagDetails {
  manifest: {
    digest: string | null
    size: number
    layers: number
    mediaType: string | null
    schemaVersion: string | null
    configDigest: string | null
  }
  imageConfig: ImageConfig | null
  configError: string | null
}

interface Props {
  registryId: string
  imageName: string
  tag: string
}

export default function TagDetailDrawer({ registryId, imageName, tag }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<TagDetails | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && !details && !loading) {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/registry/${registryId}/tag-detail?image=${encodeURIComponent(imageName)}&tag=${encodeURIComponent(tag)}`
        )
        if (!res.ok) throw new Error(`Failed to load tag details`)
        setDetails(await res.json())
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
  }

  const { manifest, imageConfig, configError } = details ?? { manifest: null, imageConfig: null, configError: null }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground px-2">
          Details <ArrowUpRight className="h-3 w-3" />
        </Button>
      </SheetTrigger>

      <SheetContent className="sm:max-w-xl p-0 flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b">
          <SheetHeader>
            <SheetTitle className="font-mono text-base pr-6">{tag}</SheetTitle>
            {manifest?.digest && (
              <p className="text-xs text-muted-foreground font-mono break-all">{manifest.digest}</p>
            )}
          </SheetHeader>
          {imageConfig?.architecture && imageConfig?.os && (
            <Badge variant="secondary" className="mt-2">
              {imageConfig.architecture}/{imageConfig.os}
            </Badge>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {loading && <DrawerSkeleton />}

          {!loading && details && (
            <>
              {/* Metadata */}
              <Section title="Metadata">
                {configError && !imageConfig && (
                  <p className="text-xs text-muted-foreground italic">
                    Config details unavailable
                    {manifest?.mediaType?.includes('list') || manifest?.mediaType?.includes('index')
                      ? ' — this is a multi-arch manifest list'
                      : manifest?.mediaType?.includes('v1')
                      ? ' — legacy v1 manifest has no config blob'
                      : ` (${configError})`}
                  </p>
                )}
                <MetaRow label="Media Type" value={manifest?.mediaType} mono />
                <MetaRow label="Schema Version" value={manifest?.schemaVersion != null ? String(manifest.schemaVersion) : null} />
                <MetaRow label="Size" value={manifest?.size ? formatBytes(manifest.size) : null} />
                <MetaRow label="Layers" value={manifest?.layers ? String(manifest.layers) : null} />
                {imageConfig?.created && <MetaRow label="Created" value={formatDate(imageConfig.created)} />}
                {imageConfig?.author && <MetaRow label="Author" value={imageConfig.author} />}
              </Section>

              {/* Container Config */}
              {imageConfig && (imageConfig.workingDir || imageConfig.entrypoint?.length || imageConfig.cmd?.length || imageConfig.exposedPorts?.length) && (
                <>
                  <Separator />
                  <Section title="Container Config">
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
                  </Section>
                </>
              )}

              {/* Environment Variables */}
              {imageConfig?.env && imageConfig.env.length > 0 && (
                <>
                  <Separator />
                  <Section title={`Environment Variables (${imageConfig.env.length})`}>
                    <div className="rounded-md border overflow-hidden">
                      {imageConfig.env.map((envVar, i) => {
                        const eqIdx = envVar.indexOf('=')
                        const key = eqIdx !== -1 ? envVar.slice(0, eqIdx) : envVar
                        const val = eqIdx !== -1 ? envVar.slice(eqIdx + 1) : ''
                        return (
                          <div key={i} className="grid grid-cols-[1fr_1.5fr] gap-3 px-3 py-1.5 text-xs font-mono border-b last:border-0 odd:bg-muted/20">
                            <span className="text-foreground font-semibold truncate">{key}</span>
                            <span className="text-muted-foreground break-all">{val}</span>
                          </div>
                        )
                      })}
                    </div>
                  </Section>
                </>
              )}

              {/* Labels */}
              {imageConfig?.labels && Object.keys(imageConfig.labels).length > 0 && (
                <>
                  <Separator />
                  <Section title={`Labels (${Object.keys(imageConfig.labels).length})`}>
                    <div className="rounded-md border overflow-hidden">
                      {Object.entries(imageConfig.labels).map(([k, v], i) => (
                        <div key={i} className="grid grid-cols-[1fr_1.5fr] gap-3 px-3 py-1.5 text-xs font-mono border-b last:border-0 odd:bg-muted/20">
                          <span className="text-foreground truncate">{k}</span>
                          <span className="text-muted-foreground break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                </>
              )}

              {/* Build History */}
              {imageConfig?.history && imageConfig.history.length > 0 && (
                <>
                  <Separator />
                  <Section title={`Build History (${imageConfig.history.length} layers)`}>
                    <div className="space-y-2">
                      {imageConfig.history.map((h, i) => (
                        <div key={i} className="flex items-start gap-3 text-xs">
                          <span className="text-muted-foreground/50 tabular-nums w-5 shrink-0 pt-0.5">{i + 1}</span>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="font-mono text-foreground/80 whitespace-pre-wrap break-all leading-relaxed">
                              {h.created_by || '<no command>'}
                            </p>
                            <div className="flex items-center gap-2">
                              {h.created && <span className="text-muted-foreground">{formatDate(h.created)}</span>}
                              {h.empty_layer && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">empty layer</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DrawerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Separator />
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-3">{children}</div>
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
