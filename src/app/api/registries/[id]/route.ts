import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { apiError } from '@/lib/utils'
import { parseRetention } from '@/lib/retention'

function isValidRegistryUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { name, url, username = '', password = '', environment = 'production', retention_keep_last, retention_protect } = await req.json()

    if (!name?.trim() || !url?.trim()) {
      return Response.json({ error: 'Name and URL required' }, { status: 400 })
    }
    if (!isValidRegistryUrl(url.trim())) {
      return Response.json({ error: 'URL must be a valid http or https address' }, { status: 400 })
    }
    if (!['production', 'staging', 'local'].includes(environment)) {
      return Response.json({ error: 'Invalid environment' }, { status: 400 })
    }

    // Omitted retention fields keep their current values — an API caller that only renames a
    // registry must not silently switch its cleanup policy off.
    const current = db.prepare('SELECT retention_keep_last, retention_protect FROM registries WHERE id = ?')
      .get(id) as unknown as { retention_keep_last: number; retention_protect: string } | undefined
    if (!current) return Response.json({ error: 'Not found' }, { status: 404 })

    const retention = parseRetention(
      retention_keep_last ?? current.retention_keep_last,
      retention_protect ?? current.retention_protect,
    )
    if (!retention) {
      return Response.json({ error: 'Keep last must be a whole number between 0 and 10000' }, { status: 400 })
    }

    // Only update password if provided (empty string means keep existing)
    if (password) {
      db.prepare('UPDATE registries SET name=?, url=?, username=?, password=?, environment=?, retention_keep_last=?, retention_protect=? WHERE id=?')
        .run(name.trim(), url.trim(), username, password, environment, retention.keepLast, retention.protect, id)
    } else {
      db.prepare('UPDATE registries SET name=?, url=?, username=?, environment=?, retention_keep_last=?, retention_protect=? WHERE id=?')
        .run(name.trim(), url.trim(), username, environment, retention.keepLast, retention.protect, id)
    }

    return Response.json({ message: 'Updated' })
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const result = db.prepare('DELETE FROM registries WHERE id = ?').run(id)
    if (result.changes === 0) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ message: 'Deleted' })
  } catch (e) {
    return apiError(e)
  }
}
