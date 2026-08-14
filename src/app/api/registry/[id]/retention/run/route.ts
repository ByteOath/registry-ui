import { requireAdmin } from '@/lib/auth'
import { runRetentionForRegistry } from '@/lib/retention'
import { apiError } from '@/lib/utils'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { deleted, errors } = await runRetentionForRegistry(id)
    return Response.json({ deleted, errors })
  } catch (e) {
    return apiError(e)
  }
}
