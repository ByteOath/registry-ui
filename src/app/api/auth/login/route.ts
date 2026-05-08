import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { getSession } from '@/lib/auth'

// In-memory rate limiter: max 10 attempts per 15 min per IP
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const window = 15 * 60 * 1000
  const max = 10
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + window })
    return false
  }
  if (entry.count >= max) return true
  entry.count++
  return false
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

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
  session.user = { id: user.id, username: user.username, role: user.role as 'super_admin' | 'admin' | 'viewer' }
  await session.save()

  return Response.json({ id: user.id, username: user.username, role: user.role })
}
