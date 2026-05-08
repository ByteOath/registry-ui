import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionUser {
  id: number
  username: string
  role: 'super_admin' | 'admin' | 'viewer'
}

export interface SessionData {
  user?: SessionUser
}

export function getSessionOptions() {
  if (!process.env.APP_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY] APP_SECRET env var not set — using insecure default. Set a 32+ char random secret.')
  }
  return {
    password: process.env.APP_SECRET || 'change-this-secret-must-be-32-chars!!',
    cookieName: 'registry-ui-session',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  }
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), getSessionOptions())
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  if (!session.user) {
    throw new Error('UNAUTHORIZED')
  }
  return session.user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }
  return user
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'super_admin') {
    throw new Error('FORBIDDEN')
  }
  return user
}
