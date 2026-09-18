/** Entry of an OCI image index / Docker manifest list. */
export interface IndexEntry {
  digest: string
  platform?: { os?: string; architecture?: string; variant?: string }
}

/** `unknown/unknown` entries are buildx attestations, not runnable images. */
export function runnableEntries(manifests: IndexEntry[]): IndexEntry[] {
  return manifests.filter(
    m => m.platform?.os && m.platform.os !== 'unknown' && m.platform.architecture !== 'unknown',
  )
}

export function platformLabel(p: IndexEntry['platform']): string {
  return [p?.os, p?.architecture].filter(Boolean).join('/') + (p?.variant ? `/${p.variant}` : '')
}

/** Platform labels of an index, deduped — Windows repeats a platform once per OS build. */
export function platformLabels(manifests: IndexEntry[]): string[] {
  return [...new Set(runnableEntries(manifests).map(m => platformLabel(m.platform)))]
}

/** A digest from the registry is interpolated into a URL path — keep it to `algo:hex`. */
export function isDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:[.+_-][a-z0-9]+)*:[a-f0-9]{32,}$/i.test(value)
}

/** The child manifest whose size/layers/config stand in for the index. linux/amd64 preferred. */
export function pickChild(manifests: IndexEntry[]): IndexEntry | undefined {
  const usable = manifests.filter(m => isDigest(m.digest))
  const runnable = runnableEntries(usable)
  return (
    runnable.find(m => m.platform?.os === 'linux' && m.platform?.architecture === 'amd64') ??
    runnable[0] ??
    usable[0]
  )
}

/**
 * Short, human-readable manifest kind. The raw media types all end in `v1+json` / `v2+json`,
 * so the tail alone cannot tell an OCI index from a plain OCI manifest.
 */
export function manifestKind(mediaType: string | null | undefined): string | null {
  if (!mediaType) return null
  if (mediaType.includes('oci.image.index')) return 'oci index'
  if (mediaType.includes('manifest.list')) return 'manifest list'
  if (mediaType.includes('oci.image.manifest')) return 'oci'
  if (mediaType.includes('manifest.v2')) return 'docker v2'
  if (mediaType.includes('manifest.v1')) return 'docker v1'
  return mediaType.split('.').pop() ?? null
}
