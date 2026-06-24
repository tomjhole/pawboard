import { Menu, LogOut, ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useBusinessContext } from '@/context/BusinessContext'

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
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, signOut } = useAuth()
  const { isAdmin, business, clearAdminView } = useBusinessContext()

  const title   = pageTitles[location.pathname] ?? 'PawBoard'
  const initial = user?.email?.[0].toUpperCase() ?? '?'

  return (
    <header className="flex-shrink-0 bg-white border-b border-slate-200">
      {/* Admin banner */}
      {isAdmin && (
        <div className="flex items-center justify-between gap-3 px-4 py-1.5 bg-violet-50 border-b border-violet-100">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
            <span className="text-xs text-violet-700">
              Admin mode
              {business && <> — viewing <strong>{business.name}</strong></>}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="text-xs font-medium text-violet-600 hover:text-violet-800 underline"
            >
              Switch business
            </button>
            <button
              onClick={clearAdminView}
              className="text-xs text-violet-500 hover:text-violet-700 underline"
            >
              Clear view
            </button>
          </div>
        </div>
      )}

      {/* Main bar */}
      <div className="flex items-center h-16 px-4 gap-3">
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
      </div>
    </header>
  )
}
