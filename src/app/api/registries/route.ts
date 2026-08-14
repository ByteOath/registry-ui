import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { apiError } from '@/lib/utils'
import { parseRetention } from '@/lib/retention'

function isValidRegistryUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

export async function GET() {
  try {
    await requireAdmin()
    const rows = db.prepare('SELECT id, name, url, username, environment, retention_keep_last, retention_protect, created_at FROM registries ORDER BY created_at DESC').all()
    return Response.json(rows)
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
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

    const retention = parseRetention(retention_keep_last, retention_protect)
    if (!retention) {
      return Response.json({ error: 'Keep last must be a whole number between 0 and 10000' }, { status: 400 })
    }

    const result = db.prepare(
      'INSERT INTO registries (name, url, username, password, environment, retention_keep_last, retention_protect) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(name.trim(), url.trim(), username, password, environment, retention.keepLast, retention.protect)

    return Response.json({ id: result.lastInsertRowid, name, url, username, environment }, { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}
