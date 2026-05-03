import { cn } from '@/lib/utils'

const styles: Record<string, string> = {
  production: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  staging:    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  local:      'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
}

const labels: Record<string, string> = {
  production: 'Production',
  staging:    'Staging',
  local:      'Local',
}

export default function EnvBadge({ env }: { env: string }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
      styles[env] ?? 'bg-secondary text-secondary-foreground border-transparent',
    )}>
      {labels[env] ?? env}
    </span>
  )
}
