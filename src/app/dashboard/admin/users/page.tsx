import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import db from '@/lib/db'
import UsersClient from './users-client'

interface User {
  id: number; username: string; role: string; created_at: string
}

export default async function UsersPage() {
  const session = await getSession()
  if (session.user?.role !== 'admin') redirect('/dashboard')

  const users = JSON.parse(JSON.stringify(
    db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC').all()
  )) as User[]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage user access and roles</p>
      </div>
      <UsersClient users={users} currentUserId={session.user!.id} />
    </div>
  )
}
