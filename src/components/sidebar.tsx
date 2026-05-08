'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/lib/auth'
import { LayoutDashboard, Users, Container } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

const adminItems = [
  { href: '/dashboard/admin/registries', label: 'Registries', icon: Container },
  { href: '/dashboard/admin/users', label: 'Users', icon: Users },
]

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname()

  return (
    <aside className="w-56 border-r bg-card flex flex-col h-full shrink-0 relative z-10">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold select-none">
            R
          </div>
          <span className="font-semibold text-sm">Registry UI</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === href
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}

        {(user.role === 'admin' || user.role === 'super_admin') && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Admin</span>
            </div>
            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  pathname.startsWith(href)
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>
    </aside>
  )
}
