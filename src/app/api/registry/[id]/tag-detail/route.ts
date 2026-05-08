import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import db from '@/lib/db'
import { getManifest, getImageConfig } from '@/lib/registry-client'
import { apiError } from '@/lib/utils'

interface Registry {
  url: string; username: string; password: string
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const image = req.nextUrl.searchParams.get('image')
    const tag = req.nextUrl.searchParams.get('tag')

    if (!image || !tag) return Response.json({ error: 'image and tag are required' }, { status: 400 })

    const IMAGE_RE = /^[a-z0-9._\-\/]+$/
    const TAG_RE = /^[a-zA-Z0-9._\-]+$/
    if (!IMAGE_RE.test(image) || !TAG_RE.test(tag)) {
      return Response.json({ error: 'Invalid image or tag' }, { status: 400 })
    }

    const registry = db
      .prepare('SELECT url, username, password FROM registries WHERE id = ?')
      .get(id) as unknown as Registry | undefined
    if (!registry) return Response.json({ error: 'Registry not found' }, { status: 404 })

    const config = {
      url: registry.url,
      username: registry.username || undefined,
      password: registry.password || undefined,
    }

    const manifest = await getManifest(config, image, tag)

    let imageConfig = null
    let configError: string | null = null
    if (manifest.configDigest) {
      try { imageConfig = await getImageConfig(config, image, manifest.configDigest) }
      catch (e) { configError = String(e) }
    }

    return Response.json({ manifest, imageConfig, configError })
  } catch (e) {
    return apiError(e)
  }
}
