import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import db from '@/lib/db'
import RegistriesClient from './registries-client'

interface Registry {
  id: number; name: string; url: string; username: string; environment: string; created_at: string
}

export default async function RegistriesPage() {
  const session = await getSession()
  if (session.user?.role !== 'admin' && session.user?.role !== 'super_admin') redirect('/dashboard')

  const registries = JSON.parse(JSON.stringify(
    db.prepare('SELECT id, name, url, username, environment, created_at FROM registries ORDER BY created_at DESC').all()
  )) as Registry[]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Registries</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage connected Docker registries</p>
      </div>
      <RegistriesClient registries={registries} />
    </div>
  )
}
