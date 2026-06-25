import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { Rocket, X, ArrowRight } from 'lucide-react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { canAccessSettings } from '@/lib/roles'

function SetupBanner() {
  const { business, settings, staffUser, isAdmin, reload } = useBusinessContext()
  const canManage = isAdmin || (staffUser ? canAccessSettings(staffUser.role) : false)
  const incomplete = !!business && !settings?.setup_completed_at

  if (!incomplete || !canManage) return null

  async function dismiss() {
    if (!business) return
    await supabase.from('business_settings').upsert(
      { business_id: business.id, setup_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'business_id' },
    )
    reload()
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border px-4 py-3"
      style={{ borderColor: 'color-mix(in srgb, var(--brand-primary) 35%, white)', backgroundColor: 'color-mix(in srgb, var(--brand-primary) 7%, white)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }}>
        <Rocket className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">Finish setting up {business!.name}</p>
        <p className="text-xs text-slate-600">Add your accommodation and pricing so you can start taking bookings.</p>
      </div>
      <Link to="/setup"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors flex-shrink-0"
        style={{ backgroundColor: 'var(--brand-primary)' }}>
        Continue setup <ArrowRight className="w-3.5 h-3.5" />
      </Link>
      <button onClick={dismiss} className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0" title="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200',
          'transform transition-transform duration-200 ease-in-out',
          'lg:static lg:translate-x-0 lg:flex-shrink-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <SetupBanner />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
