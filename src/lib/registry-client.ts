export interface RegistryConfig {
  url: string
  username?: string
  password?: string
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
    Accept: 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/json',
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
  }
}

export async function deleteManifest(config: RegistryConfig, name: string, digest: string): Promise<void> {
  const res = await registryFetch(config, `/v2/${name}/manifests/${digest}`, { method: 'DELETE' })
  if (res.status !== 202) {
    throw new Error(res.status === 405 ? 'Delete not enabled on registry (set REGISTRY_STORAGE_DELETE_ENABLED=true)' : `Delete failed: ${res.status}`)
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
