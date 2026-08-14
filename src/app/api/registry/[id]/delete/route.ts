import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { deleteManifest } from '@/lib/registry-client'
import { recordDeletion } from '@/lib/deleted-log'
import { apiError, PublicError } from '@/lib/utils'

interface Registry {
  url: string; username: string; password: string
}

interface TagRef { tag: string; digest: string; size?: number }

const IMAGE_RE = /^[a-z0-9._\-\/]+$/
const DIGEST_RE = /^sha256:[a-f0-9]{64}$/
const MAX_BATCH = 100

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const { name } = body
    const bulk = Array.isArray(body.tags)

    if (!name) return Response.json({ error: 'name required' }, { status: 400 })
    if (!IMAGE_RE.test(name)) return Response.json({ error: 'Invalid name' }, { status: 400 })

    const refs: TagRef[] = bulk
      ? body.tags
      : body.digest ? [{ tag: body.tag || body.digest, digest: body.digest, size: body.size }] : []

    if (refs.length === 0) return Response.json({ error: 'digest or tags required' }, { status: 400 })
    if (refs.length > MAX_BATCH) {
      return Response.json({ error: `Too many tags in one request (max ${MAX_BATCH})` }, { status: 400 })
    }
    if (refs.some(r => typeof r?.digest !== 'string' || !DIGEST_RE.test(r.digest))) {
      return Response.json({ error: 'Invalid digest' }, { status: 400 })
    }
    if (refs.some(r => typeof r.tag !== 'string' || !r.tag)) {
      return Response.json({ error: 'Invalid tag' }, { status: 400 })
    }

    const registry = db.prepare('SELECT url, username, password FROM registries WHERE id = ?').get(id) as unknown as Registry | undefined
    if (!registry) return Response.json({ error: 'Registry not found' }, { status: 404 })

    const config = { url: registry.url, username: registry.username || undefined, password: registry.password || undefined }

    // Single-tag path keeps its original contract: real error message, real status code.
    if (!bulk) {
      await deleteManifest(config, name, refs[0].digest)
      recordDeletion({
        registryId: id, image: name, tag: refs[0].tag, digest: refs[0].digest,
        size: refs[0].size, reason: 'manual', deletedBy: user.username,
      })
      return Response.json({ message: 'Deleted' })
    }

    // Bulk: one registry call per distinct digest — two tags sharing a digest are one delete.
    // ponytail: sequential deletes; parallelise if a 100-tag batch gets slow.
    const done = new Set<string>()
    const failed: { tag: string; error: string }[] = []
    let deleted = 0

    for (const ref of refs) {
      try {
        if (!done.has(ref.digest)) {
          await deleteManifest(config, name, ref.digest)
          done.add(ref.digest)
        }
        recordDeletion({
          registryId: id, image: name, tag: ref.tag, digest: ref.digest,
          size: ref.size, reason: 'manual', deletedBy: user.username,
        })
        deleted++
      } catch (e) {
        // Only PublicError text is safe to echo back; anything else stays in the server log.
        if (!(e instanceof PublicError)) console.error('[bulk-delete]', e)
        failed.push({ tag: ref.tag, error: e instanceof PublicError ? e.message : 'Delete failed' })
      }
    }

    return Response.json({ deleted, failed })
  } catch (e) {
    return apiError(e)
  }
}
