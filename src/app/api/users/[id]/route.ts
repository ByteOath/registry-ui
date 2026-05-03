import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { apiError } from '@/lib/utils'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params

    if (currentUser.id === Number(id)) {
      return Response.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)
    if (result.changes === 0) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ message: 'Deleted' })
  } catch (e) {
    return apiError(e)
  }
}
