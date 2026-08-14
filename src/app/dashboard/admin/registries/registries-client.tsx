'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Trash2, Loader2, Lock, Unlock, Pencil, Wifi, Timer, CheckCircle2, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import EnvBadge from '@/components/env-badge'

interface Registry {
  id: number; name: string; url: string; username: string; environment: string; created_at: string
  retention_keep_last: number; retention_protect: string
}

interface CheckResult {
  online: boolean
  repoCount: number
  repos: string[]
  authError?: boolean
}

interface FormState {
  name: string; url: string; username: string; password: string; environment: string
  retention_keep_last: string; retention_protect: string
}

const defaultForm: FormState = {
  name: '', url: '', username: '', password: '', environment: 'production',
  retention_keep_last: '0', retention_protect: 'latest',
}

function RegistryForm({
  initial,
  onSave,
  onCancel,
  saveLabel,
}: {
  initial: FormState
  onSave: (data: FormState) => Promise<void>
  onCancel: () => void
  saveLabel: string
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)

  function set(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setCheckResult(null) // reset check on any change
  }

  async function handleCheck() {
    if (!form.url.trim()) { toast.error('Enter a URL first'); return }
    setChecking(true)
    setCheckResult(null)
    const res = await fetch('/api/registries/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: form.url, username: form.username, password: form.password }),
    })
    setChecking(false)
    if (res.ok) setCheckResult(await res.json())
    else toast.error('Check failed')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await onSave(form)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Registry" required />
        </div>
        <div className="space-y-2">
          <Label>Environment</Label>
          <Select value={form.environment} onValueChange={v => set('environment', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="local">Local</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Registry URL</Label>
        <Input value={form.url} onChange={e => set('url', e.target.value)} placeholder="http://registry:5000" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Username <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input value={form.username} onChange={e => set('username', e.target.value)} placeholder="user" autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label>Password <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input value={form.password} onChange={e => set('password', e.target.value)} type="password" placeholder={initial.name ? '(unchanged)' : '••••'} autoComplete="off" />
        </div>
      </div>

      {/* Retention policy */}
      <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
        <div>
          <span className="text-xs font-medium text-muted-foreground">Automatic tag cleanup</span>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            Keeps the newest N tags of every image and permanently deletes the rest. Runs in the
            background and on demand. Deletions cannot be undone.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Keep last N tags <span className="text-muted-foreground text-xs">(0 = off)</span></Label>
            <Input
              type="number" min={0} max={10000}
              value={form.retention_keep_last}
              onChange={e => set('retention_keep_last', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Protected tags</Label>
            <Input
              value={form.retention_protect}
              onChange={e => set('retention_protect', e.target.value)}
              placeholder="latest, v*, prod-*"
            />
          </div>
        </div>
      </div>

      {/* Connectivity check */}
      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Connectivity check</span>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleCheck} disabled={checking}>
            {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
            {checking ? 'Checking…' : 'Test connection'}
          </Button>
        </div>

        {checkResult && (
          <div className={`rounded-md p-2.5 text-sm flex flex-col gap-1.5 ${checkResult.online ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-destructive/10 border border-destructive/20'}`}>
            <div className="flex items-center gap-2 font-medium">
              {checkResult.online
                ? <><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">Connected — {checkResult.repoCount} images found</span></>
                : checkResult.authError
                  ? <><XCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">Authentication failed — check username and password</span></>
                  : <><XCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">Unreachable — check URL and credentials</span></>}
            </div>
            {checkResult.online && checkResult.repos.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {checkResult.repos.map(r => (
                  <span key={r} className="font-mono text-[10px] bg-background/60 border rounded px-1.5 py-0.5">{r}</span>
                ))}
                {checkResult.repoCount > 10 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{checkResult.repoCount - 10} more</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function RegistriesClient({ registries: initial }: { registries: Registry[] }) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Registry | null>(null)
  const [cleaningId, setCleaningId] = useState<number | null>(null)

  async function handleAdd(data: FormState) {
    const res = await fetch('/api/registries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      toast.success('Registry added')
      setAddOpen(false)
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error || 'Failed to add')
    }
  }

  async function handleEdit(data: FormState) {
    if (!editTarget) return
    const res = await fetch(`/api/registries/${editTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      toast.success('Registry updated')
      setEditTarget(null)
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error || 'Failed to update')
    }
  }

  async function handleCleanup(reg: Registry) {
    setCleaningId(reg.id)
    const res = await fetch(`/api/registry/${reg.id}/retention/run`, { method: 'POST' })
    const data = await res.json()
    setCleaningId(null)
    if (!res.ok) { toast.error(data.error || 'Cleanup failed'); return }
    toast.success(`${reg.name}: deleted ${data.deleted} tag${data.deleted === 1 ? '' : 's'}`)
    if (data.errors?.length) toast.error(data.errors.slice(0, 3).join('; '))
    router.refresh()
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/registries/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Registry removed'); router.refresh() }
    else toast.error('Failed to remove registry')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" /> Add Registry</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Registry</DialogTitle>
              <DialogDescription>Connect a Docker Registry v2 endpoint.</DialogDescription>
            </DialogHeader>
            <RegistryForm
              initial={defaultForm}
              onSave={handleAdd}
              onCancel={() => setAddOpen(false)}
              saveLabel="Add"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Registry</DialogTitle>
            <DialogDescription>Update connection details for <span className="font-medium">{editTarget?.name}</span>.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <RegistryForm
              initial={{
                name: editTarget.name,
                url: editTarget.url,
                username: editTarget.username,
                password: '',
                environment: editTarget.environment,
                retention_keep_last: String(editTarget.retention_keep_last ?? 0),
                retention_protect: editTarget.retention_protect ?? 'latest',
              }}
              onSave={handleEdit}
              onCancel={() => setEditTarget(null)}
              saveLabel="Save changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {initial.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No registries added yet.</p>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {initial.map(reg => (
              <div key={reg.id} className="flex items-center justify-between px-4 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{reg.name}</span>
                    <EnvBadge env={reg.environment} />
                    {reg.username
                      ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Auth</span>
                      : <span className="flex items-center gap-1 text-xs text-muted-foreground/40"><Unlock className="h-3 w-3" />No auth</span>}
                    {reg.retention_keep_last > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground" title={`Protected: ${reg.retention_protect}`}>
                        <Timer className="h-3 w-3" />Keep {reg.retention_keep_last}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{reg.url}</p>
                </div>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:block mr-2">{formatDate(reg.created_at)}</span>
                  {reg.retention_keep_last > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Run cleanup now" disabled={cleaningId === reg.id}>
                          {cleaningId === reg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Timer className="h-3.5 w-3.5" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Run cleanup now?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Every image on <span className="font-medium">{reg.name}</span> keeps its newest{' '}
                            <span className="font-medium">{reg.retention_keep_last}</span> tags plus{' '}
                            <span className="font-mono">{reg.retention_protect || 'latest'}</span>. All other tags are
                            deleted immediately and permanently.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleCleanup(reg)}>
                            Run cleanup
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setEditTarget(reg)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove registry?</AlertDialogTitle>
                        <AlertDialogDescription>Remove <span className="font-medium">{reg.name}</span> from Registry UI. This does not delete any images.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(reg.id)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
