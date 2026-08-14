'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tag, Trash2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatBytes, formatRelativeDate } from '@/lib/utils'
import TagDetailDrawer from './tag-detail-drawer'
import DeleteTagButton from './delete-tag-button'

export interface TagRow {
  tag: string
  digest: string | null
  size: number
  layers: number
  mediaType: string | null
  created: string | null
}

interface Props {
  registryId: string
  imageName: string
  tags: TagRow[]
  isAdmin: boolean
  showCreated: boolean
}

export default function TagList({ registryId, imageName, tags, isAdmin, showCreated }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const deletable = tags.filter(t => t.digest)
  const allSelected = deletable.length > 0 && selected.size === deletable.length

  function toggle(tag: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(deletable.map(t => t.tag)))
  }

  async function handleBulkDelete() {
    const batch = deletable
      .filter(t => selected.has(t.tag))
      .map(t => ({ tag: t.tag, digest: t.digest as string, size: t.size }))
    if (batch.length === 0) return

    setDeleting(true)
    const res = await fetch(`/api/registry/${registryId}/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: imageName, tags: batch }),
    })
    const data = await res.json()
    setDeleting(false)

    if (!res.ok) {
      toast.error(data.error || 'Delete failed')
      return
    }
    if (data.deleted > 0) toast.success(`Deleted ${data.deleted} tag${data.deleted === 1 ? '' : 's'}`)
    if (data.failed?.length) {
      toast.error(`Failed: ${data.failed.map((f: { tag: string; error: string }) => `${f.tag} — ${f.error}`).join('; ')}`)
    }
    setSelected(new Set())
    router.refresh()
  }

  return (
    <>
      {isAdmin && deletable.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border bg-muted/30">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
            />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </label>

          {selected.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-7 text-xs gap-1.5" disabled={deleting}>
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Delete selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selected.size} tag{selected.size === 1 ? '' : 's'}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes{' '}
                    <span className="font-mono font-medium">{[...selected].join(', ')}</span> from{' '}
                    <span className="font-mono font-medium">{imageName}</span>. This cannot be undone.
                    Tags sharing a digest are deleted together.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleBulkDelete}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      <div className="space-y-1">
        {tags.map(({ tag, digest, size, layers, mediaType, created }) => {
          const isLatest = tag === 'latest'
          return (
            <div
              key={tag}
              className={`flex items-center justify-between px-4 py-3 rounded-lg border bg-card ${isLatest ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {isAdmin && digest && (
                  <input
                    type="checkbox"
                    checked={selected.has(tag)}
                    onChange={() => toggle(tag)}
                    aria-label={`Select ${tag}`}
                    className="h-3.5 w-3.5 shrink-0 rounded border-input accent-primary cursor-pointer"
                  />
                )}
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
                    {showCreated && created && (
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
                <TagDetailDrawer registryId={registryId} imageName={imageName} tag={tag} />
                {isAdmin && digest && (
                  <DeleteTagButton registryId={registryId} imageName={imageName} tag={tag} digest={digest} size={size} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
