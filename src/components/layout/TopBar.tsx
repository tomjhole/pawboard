import { Menu, LogOut } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calendar': 'Calendar',
  '/owners': 'Owners',
  '/pets': 'Pets',
  '/spaces': 'Spaces',
  '/settings': 'Settings',
}

interface TopBarProps {
  onMenuClick: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const title = pageTitles[location.pathname] ?? 'PawBoard'
  const initial = user?.email?.[0].toUpperCase() ?? '?'

  return (
    <header className="flex items-center h-16 px-4 bg-white border-b border-slate-200 gap-3 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2 lg:hidden">
        <span className="font-semibold text-slate-900">PawBoard</span>
      </div>

      <h1 className="hidden lg:block text-lg font-semibold text-slate-900">{title}</h1>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--brand-primary) 12%, white)',
            color: 'var(--brand-primary)',
          }}
          title={user?.email}
        >
          {initial}
        </div>
        <button
          onClick={signOut}
          className="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
