import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { apiError } from '@/lib/utils'

export async function GET() {
  try {
    await requireAdmin()
    const rows = db.prepare('SELECT id, name, url, username, environment, created_at FROM registries ORDER BY created_at DESC').all()
    return Response.json(rows)
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { name, url, username = '', password = '', environment = 'production' } = await req.json()

    if (!name?.trim() || !url?.trim()) {
      return Response.json({ error: 'Name and URL required' }, { status: 400 })
    }
    if (!['production', 'staging', 'local'].includes(environment)) {
      return Response.json({ error: 'Invalid environment' }, { status: 400 })
    }

    const result = db.prepare(
      'INSERT INTO registries (name, url, username, password, environment) VALUES (?, ?, ?, ?, ?)'
    ).run(name.trim(), url.trim(), username, password, environment)

    return Response.json({ id: result.lastInsertRowid, name, url, username, environment }, { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}
