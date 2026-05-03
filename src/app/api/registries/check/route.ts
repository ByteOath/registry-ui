import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getCatalog, pingRegistry } from '@/lib/registry-client'
import { apiError } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { url, username = '', password = '' } = await req.json()

    if (!url?.trim()) return Response.json({ error: 'URL required' }, { status: 400 })

    const config = { url: url.trim(), username: username || undefined, password: password || undefined }

    const online = await pingRegistry(config)
    if (!online) {
      return Response.json({ online: false, repoCount: 0, repos: [] })
    }

    try {
      const repos = await getCatalog(config)
      return Response.json({ online: true, repoCount: repos.length, repos: repos.slice(0, 10) })
    } catch {
      return Response.json({ online: true, repoCount: 0, repos: [] })
    }
  } catch (e) {
    return apiError(e)
  }
}
