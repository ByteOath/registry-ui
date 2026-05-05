"use client"

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'

const OPTIONS = [
  { value: 'created', label: 'Created Date' },
  { value: 'name',    label: 'Name' },
  { value: 'size',    label: 'Size' },
]

export default function SortSelect({ value }: { value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', next)
    router.push(`${pathname}?${params}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex items-center rounded-md border text-xs overflow-hidden">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={`px-3 py-1.5 transition-colors border-r last:border-r-0 ${
              value === opt.value
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
