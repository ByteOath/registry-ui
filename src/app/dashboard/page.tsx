import Link from 'next/link'
import { Suspense } from 'react'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getCatalog } from '@/lib/registry-client'
import { Badge } from '@/components/ui/badge'
import { Container, ChevronRight, Lock, Unlock } from 'lucide-react'
import EnvBadge from '@/components/env-badge'
import ViewToggle from '@/components/view-toggle'

interface Registry {
  id: number; name: string; url: string; username: string; password: string; environment: string
}

async function getRegistryStats(registry: Registry) {
  try {
    const repos = await getCatalog({
      url: registry.url,
      username: registry.username || undefined,
      password: registry.password || undefined,
    })
    return { repoCount: repos.length, online: true }
  } catch {
    return { repoCount: 0, online: false }
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  await getSession()
  const { view } = await searchParams
  const mode = view === 'card' ? 'card' : 'list'

  const registries = JSON.parse(JSON.stringify(
    db.prepare('SELECT id, name, url, username, password, environment FROM registries ORDER BY created_at DESC').all()
  )) as Registry[]

  const stats = await Promise.all(registries.map(r => getRegistryStats(r)))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {registries.length} {registries.length === 1 ? 'registry' : 'registries'} connected
          </p>
        </div>
        {registries.length > 0 && (
          <Suspense>
            <ViewToggle view={mode} />
          </Suspense>
        )}
      </div>

      {registries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card">
          <Container className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">No registries yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Go to{' '}
            <Link href="/dashboard/admin/registries" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Admin → Registries
            </Link>{' '}
            to add one.
          </p>
        </div>
      ) : mode === 'list' ? (

        /* ── LIST VIEW ── */
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_80px_80px_80px_32px] items-center gap-3 px-4 py-2.5 border-b bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Registry</span>
            <span>Environment</span>
            <span className="text-center">Images</span>
            <span className="text-center">Auth</span>
            <span className="text-center">Status</span>
            <span />
          </div>
          <div className="divide-y">
            {registries.map((reg, i) => {
              const stat = stats[i]
              return (
                <Link
                  key={reg.id}
                  href={`/dashboard/registry/${reg.id}`}
                  className="grid grid-cols-[1fr_140px_80px_80px_80px_32px] items-center gap-3 px-4 py-3.5 hover:bg-accent/40 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{reg.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{reg.url}</p>
                  </div>
                  <div><EnvBadge env={reg.environment} /></div>
                  <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <Container className="h-3.5 w-3.5 shrink-0" />
                    {stat.online ? stat.repoCount : '—'}
                  </div>
                  <div className="flex justify-center">
                    {reg.username
                      ? <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      : <Unlock className="h-3.5 w-3.5 text-muted-foreground/30" />}
                  </div>
                  <div className="flex justify-center">
                    {stat.online
                      ? <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Online</span>
                      : <Badge variant="destructive" className="text-[10px] h-5 px-1.5">Offline</Badge>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                </Link>
              )
            })}
          </div>
        </div>

      ) : (

        /* ── CARD VIEW ── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {registries.map((reg, i) => {
            const stat = stats[i]
            return (
              <Link key={reg.id} href={`/dashboard/registry/${reg.id}`}>
                <div className="group rounded-xl border bg-card hover:bg-accent/30 transition-colors h-full flex flex-col overflow-hidden">
                  {/* Card header stripe by env */}
                  <div className={`h-1 w-full shrink-0 ${
                    reg.environment === 'production' ? 'bg-rose-500/60' :
                    reg.environment === 'staging'    ? 'bg-amber-500/60' :
                                                       'bg-sky-500/60'
                  }`} />
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{reg.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{reg.url}</p>
                      </div>
                      {stat.online
                        ? <span className="inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Online</span>
                        : <Badge variant="destructive" className="text-[10px] shrink-0">Offline</Badge>}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <EnvBadge env={reg.environment} />
                      {reg.username
                        ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Auth</span>
                        : <span className="flex items-center gap-1 text-xs text-muted-foreground/40"><Unlock className="h-3 w-3" />No auth</span>}
                    </div>

                    {/* Stats */}
                    <div className="mt-auto pt-3 border-t flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Container className="h-3.5 w-3.5" />
                        {stat.online ? <><strong className="text-foreground">{stat.repoCount}</strong> images</> : '—'}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
