import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, ChevronRight, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '@/context/PortalContext'
import { Card } from '@/components/ui'
import { StatusPill, fmtDate, nights, todayIso, type DbBookingStatus } from './shared'

type HomeBooking = {
  id: string
  status: DbBookingStatus
  start_date: string
  end_date: string
  booking_pets: { pet: { name: string } | null }[]
}

type HomePet = {
  id: string
  name: string
  breed: string | null
  species: { icon: string | null; colour: string | null } | null
}

export default function PortalHomePage() {
  const { owner, settings } = usePortal()
  const [bookings, setBookings] = useState<HomeBooking[]>([])
  const [pets,     setPets]     = useState<HomePet[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!owner) return
    const today = todayIso()
    Promise.all([
      supabase
        .from('bookings')
        .select('id, status, start_date, end_date, booking_pets ( pet:pet_id ( name ) )')
        .eq('owner_id', owner.id)
        .gte('end_date', today)
        .not('status', 'in', '(cancelled,checked_out)')
        .order('start_date'),
      supabase
        .from('pets')
        .select('id, name, breed, species:species_id ( icon, colour )')
        .eq('owner_id', owner.id)
        .eq('is_active', true)
        .order('name'),
    ]).then(([bRes, pRes]) => {
      setBookings((bRes.data ?? []) as unknown as HomeBooking[])
      setPets((pRes.data ?? []) as unknown as HomePet[])
      setLoading(false)
    })
  }, [owner])

  if (!owner || !settings) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hello, {owner.first_name} 👋</h1>
        <p className="text-sm text-slate-500 mt-0.5">Here’s what’s coming up for your pets.</p>
      </div>

      {/* Upcoming & current bookings */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Upcoming stays</h2>
          {settings.portal_allow_booking_requests && (
            <Link
              to="/portal/request"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Request a stay
            </Link>
          )}
        </div>

        {loading ? (
          <Card><p className="text-sm text-slate-400 py-4 text-center">Loading…</p></Card>
        ) : bookings.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No upcoming stays booked.</p>
              {settings.portal_allow_booking_requests && (
                <Link to="/portal/request" className="text-sm font-medium mt-2 inline-block"
                  style={{ color: 'var(--brand-primary)' }}>
                  Request a stay →
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {bookings.map(b => {
              const names = b.booking_pets.map(bp => bp.pet?.name).filter(Boolean).join(', ')
              return (
                <Card key={b.id} padding="sm">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{fmtDate(b.start_date)}</span>
                        <span className="text-slate-300">→</span>
                        <span className="text-sm font-semibold text-slate-900">{fmtDate(b.end_date)}</span>
                        <StatusPill status={b.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {nights(b.start_date, b.end_date)} night{nights(b.start_date, b.end_date) === 1 ? '' : 's'}
                        {names && <> · {names}</>}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Pets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">My pets</h2>
          <Link to="/portal/pets" className="text-xs font-medium text-slate-500 hover:text-slate-700">View all</Link>
        </div>
        {!loading && pets.length === 0 ? (
          <Card><p className="text-sm text-slate-400 py-3 text-center italic">No pets on record yet.</p></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {pets.map(p => (
              <Link key={p.id} to={`/portal/pets/${p.id}`}>
                <Card padding="sm" className="hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 select-none"
                      style={{ backgroundColor: p.species?.colour ? `${p.species.colour}20` : '#f1f5f9' }}>
                      {p.species?.icon ?? '🐾'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                      {p.breed && <p className="text-xs text-slate-500 truncate">{p.breed}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
