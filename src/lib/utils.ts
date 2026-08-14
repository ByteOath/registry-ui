import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

/** Converts node:sqlite null-prototype rows to plain serializable objects */
export function toPlain<T>(data: unknown): T {
  return JSON.parse(JSON.stringify(data)) as T
}

/** Error whose message is safe to show the user — operator-actionable, no internals. */
export class PublicError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = 'PublicError'
  }
}

export function apiError(e: unknown): Response {
  if (e instanceof Error) {
    if (e.message === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (e.message === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (e instanceof PublicError) return Response.json({ error: e.message }, { status: e.status })
  console.error('[apiError]', e)
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}
