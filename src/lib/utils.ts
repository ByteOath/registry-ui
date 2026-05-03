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

/** Converts node:sqlite null-prototype rows to plain serializable objects */
export function toPlain<T>(data: unknown): T {
  return JSON.parse(JSON.stringify(data)) as T
}

export function apiError(e: unknown): Response {
  if (e instanceof Error) {
    if (e.message === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (e.message === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  return Response.json({ error: String(e) }, { status: 500 })
}
