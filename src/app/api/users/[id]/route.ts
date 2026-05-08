import { requireAdmin } from '@/lib/auth'
import db from '@/lib/db'
import { apiError } from '@/lib/utils'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      return Response.json({ error: 'Invalid id' }, { status: 400 })
    }

    if (currentUser.id === Number(id)) {
      return Response.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined
    if (!target) return Response.json({ error: 'Not found' }, { status: 404 })

    // Can't delete super_admin users
    if (target.role === 'super_admin') {
      return Response.json({ error: 'Cannot delete super_admin users' }, { status: 403 })
    }

    // admin can only delete viewer users
    if (currentUser.role === 'admin' && target.role === 'admin') {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)
    return Response.json({ message: 'Deleted' })
  } catch (e) {
    return apiError(e)
  }
}
