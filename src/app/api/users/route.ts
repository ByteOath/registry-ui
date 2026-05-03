import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { apiError } from '@/lib/utils'

export async function GET() {
  try {
    await requireAdmin()
    const rows = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC').all()
    return Response.json(rows)
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { username, password, role = 'viewer' } = await req.json()

    if (!username?.trim() || !password) {
      return Response.json({ error: 'Username and password required' }, { status: 400 })
    }
    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (!['admin', 'viewer'].includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 })
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim())
    if (existing) return Response.json({ error: 'Username already exists' }, { status: 409 })

    const hash = bcrypt.hashSync(password, 10)
    const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username.trim(), hash, role)

    return Response.json({ id: result.lastInsertRowid, username, role }, { status: 201 })
  } catch (e) {
    return apiError(e)
  }
}
