import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { PawPrint, Home, CalendarPlus, User, LogOut, Dog, BookOpen } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePortal } from '@/context/PortalContext'
import LoadingState from '@/components/ui/LoadingState'

function PortalDisabled({ businessName }: { businessName: string | null }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto"
             style={{ backgroundColor: 'var(--brand-primary)' }}>
          <PawPrint className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-base font-semibold text-slate-900 mb-2">Portal unavailable</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          {businessName ? <><span className="font-medium">{businessName}</span> hasn't</> : 'This business hasn’t'}
          {' '}enabled the owner portal yet. Please contact them directly to manage your bookings.
        </p>
        <button
          onClick={signOut}
          className="mt-5 text-sm font-medium text-slate-500 hover:text-slate-700 underline"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

const navBase =
  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap'

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? navBase
    : `${navBase} text-slate-500 hover:bg-slate-100 hover:text-slate-700`
}
function linkStyle({ isActive }: { isActive: boolean }) {
  return isActive
    ? { color: 'var(--brand-primary)', backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, white)' }
    : {}
}

export default function PortalShell() {
  const { state } = usePortal()
  const { signOut } = useAuth()

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingState message="Loading your account…" />
      </div>
    )
  }
  if (state.status === 'not-portal') return <Navigate to="/" replace />
  if (state.status === 'disabled')  return <PortalDisabled businessName={state.business?.name ?? null} />

  const { business, owner, settings } = state

  const nav = [
    { to: '/portal',         label: 'Home',     icon: Home,         end: true },
    { to: '/portal/pets',    label: 'My pets',  icon: Dog,          end: false },
    ...(settings.stay_journal_owner_visible
      ? [{ to: '/portal/updates', label: 'Updates', icon: BookOpen, end: false }]
      : []),
    ...(settings.portal_allow_booking_requests
      ? [{ to: '/portal/request', label: 'Request a stay', icon: CalendarPlus, end: false }]
      : []),
    { to: '/portal/profile', label: 'Profile',  icon: User,         end: false },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'var(--brand-primary)' }}>
                <PawPrint className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{business.name}</p>
                <p className="text-xs text-slate-400 truncate leading-tight">
                  {owner.first_name} {owner.last_name}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
          <nav className="flex items-center gap-1 -mb-px overflow-x-auto pb-2">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass} style={linkStyle}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
