import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import LoginForm from './login-form'

export default async function LoginPage() {
  const session = await getSession()
  if (session.user) redirect('/dashboard')
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground mb-4 text-xl font-bold">R</div>
          <h1 className="text-2xl font-semibold">Registry UI</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
