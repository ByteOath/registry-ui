import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { deleteManifest } from '@/lib/registry-client'
import { apiError } from '@/lib/utils'

interface Registry {
  url: string; username: string; password: string
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { name, digest } = await req.json()

    if (!name || !digest) {
      return Response.json({ error: 'name and digest required' }, { status: 400 })
    }

    const registry = db.prepare('SELECT url, username, password FROM registries WHERE id = ?').get(id) as unknown as Registry | undefined
    if (!registry) return Response.json({ error: 'Registry not found' }, { status: 404 })

    await deleteManifest(
      { url: registry.url, username: registry.username || undefined, password: registry.password || undefined },
      name,
      digest,
    )

    return Response.json({ message: 'Deleted' })
  } catch (e) {
    return apiError(e)
  }
}
