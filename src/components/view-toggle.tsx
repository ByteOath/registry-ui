'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LayoutList, LayoutGrid } from 'lucide-react'

export default function ViewToggle({ view }: { view: 'list' | 'card' }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setView(v: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', v)
    router.replace(`${pathname}?${p.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
      <Button
        variant={view === 'list' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7"
        onClick={() => setView('list')}
        title="List view"
      >
        <LayoutList className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant={view === 'card' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7"
        onClick={() => setView('card')}
        title="Card view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
