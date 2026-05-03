import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return Response.json({ error: 'Username and password required' }, { status: 400 })
  }

  const user = db.prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?').get(username) as unknown as
    | { id: number; username: string; password_hash: string; role: string }
    | undefined

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const session = await getSession()
  session.user = { id: user.id, username: user.username, role: user.role as 'admin' | 'viewer' }
  await session.save()

  return Response.json({ id: user.id, username: user.username, role: user.role })
}
