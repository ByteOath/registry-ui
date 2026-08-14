'use client'
import { useRouter, usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function DeletedFilter({ registries, registry, q }: {
  registries: { id: number; name: string }[]
  registry: string
  q: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  function apply(next: { registry?: string; q?: string }) {
    const params = new URLSearchParams()
    const reg = next.registry ?? registry
    const query = next.q ?? q
    if (reg) params.set('registry', reg)
    if (query) params.set('q', query)
    router.push(params.toString() ? `${pathname}?${params}` : pathname)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          defaultValue={q}
          placeholder="Filter by image or tag…"
          className="pl-9 h-9"
          onKeyDown={e => { if (e.key === 'Enter') apply({ q: (e.target as HTMLInputElement).value }) }}
        />
      </div>
      <select
        value={registry}
        onChange={e => apply({ registry: e.target.value })}
        className="h-9 rounded-md border bg-background px-3 text-sm text-muted-foreground"
      >
        <option value="">All registries</option>
        {registries.map(r => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
      </select>
    </div>
  )
}
