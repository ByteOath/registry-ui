import { PublicError } from './utils'

export interface RegistryConfig {
  url: string
  username?: string
  password?: string
}

export interface ImageConfig {
  architecture: string | null
  os: string | null
  created: string | null
  author: string | null
  labels: Record<string, string> | null
  env: string[] | null
  exposedPorts: string[] | null
  workingDir: string | null
  entrypoint: string[] | null
  cmd: string[] | null
  history: Array<{ created?: string; created_by?: string; empty_layer?: boolean }>
}

interface RequestResult {
  status: number
  body: string
  headers: Record<string, string>
}

async function registryFetch(
  config: RegistryConfig,
  path: string,
  options: RequestInit = {},
  bearerToken?: string,
  retry = false,
): Promise<RequestResult> {
  const url = path.startsWith('http') ? path : config.url.replace(/\/$/, '') + path

  const headers: Record<string, string> = {
    Accept: 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json, application/json',
    ...(options.headers as Record<string, string>),
  }

  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`
  } else if (config.username) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64')
  }

  const res = await fetch(url, { ...options, headers, cache: 'no-store' })
  const body = await res.text()
  const resHeaders: Record<string, string> = {}
  res.headers.forEach((v, k) => { resHeaders[k.toLowerCase()] = v })

  // Handle Bearer token challenge
  if (res.status === 401 && !retry) {
    const wwwAuth = resHeaders['www-authenticate'] || ''
    if (wwwAuth.startsWith('Bearer ')) {
      const token = await fetchBearerToken(wwwAuth, config)
      if (token) {
        return registryFetch(config, path, options, token, true)
      }
    }
  }

  return { status: res.status, body, headers: resHeaders }
}

async function fetchBearerToken(wwwAuth: string, config: RegistryConfig): Promise<string | null> {
  const realmMatch = wwwAuth.match(/realm="([^"]+)"/)
  const serviceMatch = wwwAuth.match(/service="([^"]+)"/)
  const scopeMatch = wwwAuth.match(/scope="([^"]+)"/)
  if (!realmMatch) return null

  const params = new URLSearchParams()
  if (serviceMatch) params.set('service', serviceMatch[1])
  if (scopeMatch) params.set('scope', scopeMatch[1])

  const tokenUrl = `${realmMatch[1]}?${params}`
  const headers: Record<string, string> = {}
  if (config.username) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64')
  }

  try {
    const res = await fetch(tokenUrl, { headers, cache: 'no-store' })
    const data = await res.json()
    return data.token || data.access_token || null
  } catch {
    return null
  }
}

function parseNextLink(headers: Record<string, string>): string | null {
  const link = headers['link']
  if (!link) return null
  const m = link.match(/<([^>]+)>;\s*rel="next"/)
  return m ? m[1] : null
}

export async function getCatalog(config: RegistryConfig): Promise<string[]> {
  const repos: string[] = []
  let path: string | null = '/v2/_catalog?n=100'
  while (path) {
    const res = await registryFetch(config, path)
    if (res.status !== 200) throw new Error(`Registry error ${res.status}: ${res.body}`)
    const data = JSON.parse(res.body)
    repos.push(...(data.repositories || []))
    path = parseNextLink(res.headers)
  }
  return repos
}

export async function getTags(config: RegistryConfig, name: string): Promise<string[]> {
  const tags: string[] = []
  let path: string | null = `/v2/${name}/tags/list?n=100`
  while (path) {
    const res = await registryFetch(config, path)
    if (res.status !== 200) throw new Error(`Registry error ${res.status}: ${res.body}`)
    const data = JSON.parse(res.body)
    tags.push(...(data.tags || []))
    path = parseNextLink(res.headers)
  }
  return tags
}

export async function getManifest(config: RegistryConfig, name: string, reference: string) {
  const res = await registryFetch(config, `/v2/${name}/manifests/${reference}`)
  if (res.status !== 200) throw new Error(`Registry error ${res.status}`)
  const manifest = JSON.parse(res.body)
  const digest = res.headers['docker-content-digest'] || null

  let size = 0
  if (manifest.layers) {
    for (const layer of manifest.layers) size += layer.size || 0
    if (manifest.config?.size) size += manifest.config.size
  }

  return {
    digest,
    size,
    layers: (manifest.layers || manifest.fsLayers || []).length,
    mediaType: manifest.mediaType || null,
    schemaVersion: manifest.schemaVersion || null,
    configDigest: manifest.config?.digest ?? null,
  }
}

export async function getImageConfig(
  config: RegistryConfig,
  name: string,
  configDigest: string,
): Promise<ImageConfig> {
  const res = await registryFetch(config, `/v2/${name}/blobs/${configDigest}`, {
    headers: { Accept: 'application/octet-stream, application/json, */*' },
  })
  if (res.status !== 200) throw new Error(`Registry error ${res.status}`)
  const data = JSON.parse(res.body)
  return {
    architecture: data.architecture ?? null,
    os: data.os ?? null,
    created: data.created ?? null,
    author: data.author ?? null,
    labels: data.config?.Labels ?? null,
    env: data.config?.Env ?? null,
    exposedPorts: data.config?.ExposedPorts ? Object.keys(data.config.ExposedPorts) : null,
    workingDir: data.config?.WorkingDir ?? null,
    entrypoint: data.config?.Entrypoint ?? null,
    cmd: data.config?.Cmd ?? null,
    history: (data.history ?? []).map((h: { created?: string; created_by?: string; empty_layer?: boolean }) => ({
      created: h.created,
      created_by: h.created_by,
      empty_layer: h.empty_layer,
    })),
  }
}

export interface TagMeta {
  tag: string
  digest: string | null
  size: number
  layers: number
  mediaType: string | null
  schemaVersion: number | null
  configDigest: string | null
  created: string | null
}

/**
 * Lists every tag of an image with its manifest metadata. `withCreated` also pulls the image
 * config blob for the build date — one extra request per tag.
 * ponytail: N+1 registry fetches; add a digest->meta cache if catalogs get large.
 */
export async function listTagsWithMeta(
  config: RegistryConfig,
  name: string,
  withCreated = false,
): Promise<TagMeta[]> {
  const tags = await getTags(config, name)
  return Promise.all(
    tags.map(async (tag): Promise<TagMeta> => {
      try {
        const manifest = await getManifest(config, name, tag)
        let created: string | null = null
        if (withCreated && manifest.configDigest) {
          try {
            created = (await getImageConfig(config, name, manifest.configDigest)).created
          } catch { /* best-effort */ }
        }
        return { tag, ...manifest, created }
      } catch {
        return { tag, digest: null, size: 0, layers: 0, mediaType: null, schemaVersion: null, configDigest: null, created: null }
      }
    }),
  )
}

/** Newest build first, tags with no build date last, `latest` always pinned to the top. */
export function sortTagsByCreated<T extends { tag: string; created: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.tag === 'latest') return -1
    if (b.tag === 'latest') return 1
    if (!a.created && !b.created) return 0
    if (!a.created) return 1
    if (!b.created) return -1
    return new Date(b.created).getTime() - new Date(a.created).getTime()
  })
}

export async function deleteManifest(config: RegistryConfig, name: string, digest: string): Promise<void> {
  const res = await registryFetch(config, `/v2/${name}/manifests/${digest}`, { method: 'DELETE' })
  if (res.status !== 202) {
    if (res.status === 405) {
      throw new PublicError('Delete not enabled on registry (set REGISTRY_STORAGE_DELETE_ENABLED=true)', 409)
    }
    if (res.status === 404) throw new PublicError('Tag already deleted on the registry', 404)
    throw new PublicError(`Delete failed: registry returned ${res.status}`, 502)
  }
}

export async function pingRegistry(config: RegistryConfig): Promise<boolean> {
  try {
    const res = await registryFetch(config, '/v2/')
    return res.status === 200 || res.status === 401
  } catch {
    return false
  }
}
