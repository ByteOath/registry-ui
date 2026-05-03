import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  return Response.json(session.user || null)
}
