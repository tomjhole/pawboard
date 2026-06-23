import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Users,
  PawPrint,
  Building2,
  Settings,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useBusinessContext } from '@/context/BusinessContext'

interface SidebarProps {
  onClose: () => void
}

const mainNav = [
  { to: '/calendar',  label: 'Calendar',  icon: CalendarDays   },
  { to: '/bookings',  label: 'Bookings',  icon: ClipboardList  },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/owners',    label: 'Owners',    icon: Users          },
  { to: '/pets',      label: 'Pets',      icon: PawPrint       },
  { to: '/spaces',    label: 'Spaces',    icon: Building2      },
]

const navBase = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors'

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? navBase
    : `${navBase} text-slate-600 hover:bg-slate-50 hover:text-slate-900`
}

function navStyle({ isActive }: { isActive: boolean }) {
  return isActive
    ? {
        color: 'var(--brand-primary)',
        backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, white)',
      }
    : {}
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user } = useAuth()
  const { staffUser, business } = useBusinessContext()

  const displayName = staffUser
    ? `${staffUser.first_name} ${staffUser.last_name}`.trim()
    : user?.email ?? ''
  const initial = displayName[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between h-16 px-5 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ backgroundColor: 'var(--brand-primary)' }}>
            <PawPrint className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-semibold text-slate-900 tracking-tight">PawBoard</span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {mainNav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={navClass} style={navStyle} onClick={onClose}>
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-3 border-t border-slate-200 pt-3 space-y-0.5">
        <NavLink to="/settings" className={navClass} style={navStyle} onClick={onClose}>
          <Settings className="w-5 h-5 flex-shrink-0" />
          Settings
        </NavLink>

        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
               style={{
                 backgroundColor: 'color-mix(in srgb, var(--brand-primary) 12%, white)',
                 color: 'var(--brand-primary)',
               }}>
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{displayName}</p>
            {business && (
              <p className="text-xs text-slate-500 truncate">{business.name}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
