'use client'
import { useRouter } from 'next/navigation'
import type { SessionUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'
import ThemeToggle from '@/components/theme-toggle'

export default function Header({ user }: { user: SessionUser }) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 border-b bg-card flex items-center justify-end px-5 gap-1 shrink-0 relative z-50">
      <ThemeToggle />

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 px-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold select-none">
              {user.username[0].toUpperCase()}
            </div>
            <span className="text-sm font-medium">{user.username}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48" sideOffset={8}>
          <DropdownMenuLabel className="font-normal py-2">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{user.role}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
