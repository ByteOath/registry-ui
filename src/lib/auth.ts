import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionUser {
  id: number
  username: string
  role: 'admin' | 'viewer'
}

export interface SessionData {
  user?: SessionUser
}

export const sessionOptions = {
  password: process.env.APP_SECRET || 'change-this-secret-must-be-32-chars!!',
  cookieName: 'registry-ui-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
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
  if (user.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }
  return user
}
