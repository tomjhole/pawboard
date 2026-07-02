import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Clock, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { Card, StatusBadge } from '@/components/ui'
import {
  type DbBookingStatus,
  computeDisplayStatus, hasOutstandingDetails, dbStatusToUi, formatBookingDate,
} from '@/pages/BookingsPage'

// ─── Types ────────────────────────────────────────────────────────────────────

type DashPet = {
  id: string
  name: string
  species: { name: string; icon: string | null; colour: string | null } | null
  vet_practice_name: string | null
  vet_phone: string | null
  microchip_number: string | null
}

type DashOwner = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  address_line1: string | null
  city: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

type DashBooking = {
  id: string
  status: DbBookingStatus
  start_date: string
  end_date: string
  owner: DashOwner | null
  booking_pets: { pet: DashPet | null }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIsoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function dayLabel(iso: string, todayStr: string): string {
  const tomorrow = toIsoDate(addDays(new Date(), 1))
  if (iso === todayStr)  return 'Today'
  if (iso === tomorrow)  return 'Tomorrow'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

const DASH_SELECT = `
  id, status, start_date, end_date,
  owner:owner_id (
    id, first_name, last_name, email,
    address_line1, city,
    emergency_contact_name, emergency_contact_phone
  ),
  booking_pets (
    pet:pet_id ( id, name, vet_practice_name, vet_phone, microchip_number,
      species:species_id ( name, icon, colour ) )
  )
`

// ─── BookingListItem ──────────────────────────────────────────────────────────

function BookingListItem({ booking, dateIso, todayStr }: { booking: DashBooking; dateIso: string; todayStr: string }) {
  const displayStatus = computeDisplayStatus(booking.status, hasOutstandingDetails(booking), booking.end_date)
  const owner = booking.owner
  const pets  = booking.booking_pets.map(bp => bp.pet).filter(Boolean) as DashPet[]

  return (
    <Link
      to={`/bookings/${booking.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
    >
      <div className="w-20 flex-shrink-0 hidden sm:block">
        <p className="text-xs font-semibold text-slate-500">{dayLabel(dateIso, todayStr)}</p>
      </div>
      <div className="flex-shrink-0 hidden sm:block w-32">
        <StatusBadge status={dbStatusToUi(displayStatus)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {owner ? `${owner.first_name} ${owner.last_name}` : '—'}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {pets.length === 0 ? 'No pets' : pets.map(p => (
            <span key={p.id} className="mr-2">
              {p.species?.icon && <span className="mr-0.5">{p.species.icon}</span>}
              {p.name}
            </span>
          ))}
        </p>
      </div>
      <p className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">
        {formatBookingDate(booking.start_date)} – {formatBookingDate(booking.end_date)}
      </p>
      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
    </Link>
  )
}

// ─── WeekSection ─────────────────────────────────────────────────────────────

function WeekSection({
  title, icon: Icon, iconCls, bookings, dateKey, todayStr, emptyText,
}: {
  title:    string
  icon:     React.ElementType
  iconCls:  string
  bookings: DashBooking[]
  dateKey:  'start_date' | 'end_date'
  todayStr: string
  emptyText: string
}) {
  return (
    <Card padding="none">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <Icon className={`w-4 h-4 flex-shrink-0 ${iconCls}`} />
        <h2 className="text-sm font-semibold text-slate-700 flex-1">{title}</h2>
        {bookings.length > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {bookings.length}
          </span>
        )}
      </div>
      {bookings.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 italic text-center">{emptyText}</p>
      ) : (
        <div>
          {bookings.map(b => (
            <BookingListItem key={b.id} booking={b} dateIso={b[dateKey]} todayStr={todayStr} />
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { business } = useBusinessContext()

  const today   = toIsoDate(new Date())
  const in7days = toIsoDate(addDays(new Date(), 7))

  const [loading,      setLoading]      = useState(true)
  const [arrivals,     setArrivals]     = useState<DashBooking[]>([])
  const [departures,   setDepartures]   = useState<DashBooking[]>([])
  const [enquiries,    setEnquiries]    = useState<DashBooking[]>([])
  const [boardingCount, setBoardingCount] = useState<number | null>(null)
  const [totalSpaces,   setTotalSpaces]   = useState<number | null>(null)
  const [occupiedToday, setOccupiedToday] = useState<number | null>(null)

  useEffect(() => {
    if (!business) return

    async function load() {
      setLoading(true)
      const [arrivalsRes, departuresRes, enquiriesRes, boardingRes, spacesRes, assignmentsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select(DASH_SELECT)
          .gte('start_date', today)
          .lte('start_date', in7days)
          .not('status', 'in', '(cancelled,checked_out)')
          .order('start_date'),

        supabase
          .from('bookings')
          .select(DASH_SELECT)
          .in('status', ['confirmed', 'checked_in', 'due_out'])
          .gte('end_date', today)
          .lte('end_date', in7days)
          .order('end_date'),

        supabase
          .from('bookings')
          .select(DASH_SELECT)
          .in('status', ['enquiry', 'waiting_list'])
          .gte('start_date', today)
          .order('start_date'),

        supabase
          .from('bookings')
          .select('booking_pets(id)')
          .in('status', ['checked_in', 'due_out']),

        supabase
          .from('accommodation_spaces')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),

        supabase
          .from('booking_space_assignments')
          .select('space_id')
          .lte('start_date', today)
          .gte('end_date', today),
      ])

      setArrivals((arrivalsRes.data ?? []) as unknown as DashBooking[])
      setDepartures((departuresRes.data ?? []) as unknown as DashBooking[])
      setEnquiries((enquiriesRes.data ?? []) as unknown as DashBooking[])
      setBoardingCount(
        ((boardingRes.data ?? []) as { booking_pets: { id: string }[] }[])
          .reduce((n, b) => n + (b.booking_pets?.length ?? 0), 0)
      )
      setTotalSpaces(spacesRes.count ?? 0)
      const occupiedIds = new Set((assignmentsRes.data ?? []).map((r: any) => r.space_id))
      setOccupiedToday(occupiedIds.size)
      setLoading(false)
    }

    load()
  }, [business])

  const availableSpaces = totalSpaces !== null && occupiedToday !== null
    ? Math.max(0, totalSpaces - occupiedToday)
    : null

  const weekLabel = (() => {
    const end = addDays(new Date(), 7)
    const s = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const e = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return `${s} – ${e}`
  })()

  // Totals count pets, not bookings (a booking may hold several pets).
  const petCount = (list: DashBooking[]) => list.reduce((n, b) => n + b.booking_pets.length, 0)

  const stats = [
    { label: 'Pending',        value: loading ? '—' : String(petCount(enquiries)),                  sub: 'enquiries & waiting list', colour: 'text-amber-600'   },
    { label: 'Arriving',       value: loading ? '—' : String(petCount(arrivals)),                   sub: 'in the next 7 days',       colour: 'text-emerald-600' },
    { label: 'Departing',      value: loading ? '—' : String(petCount(departures)),                 sub: 'in the next 7 days',       colour: 'text-rose-600'    },
    { label: 'Boarding now',   value: loading || boardingCount === null ? '—' : String(boardingCount), sub: 'pets currently checked in', colour: 'text-indigo-600'  },
    { label: 'Spaces free',    value: loading || availableSpaces === null ? '—' : String(availableSpaces), sub: totalSpaces !== null ? `of ${totalSpaces} total` : '', colour: 'text-slate-700' },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">This week</h1>
        <p className="text-sm text-slate-500 mt-0.5">{weekLabel}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-0.5 ${s.colour}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <WeekSection
          title="Arriving this week"
          icon={CheckCircle}
          iconCls="text-emerald-500"
          bookings={arrivals}
          dateKey="start_date"
          todayStr={today}
          emptyText="No arrivals in the next 7 days"
        />
        <WeekSection
          title="Departing this week"
          icon={CheckCircle}
          iconCls="text-rose-500"
          bookings={departures}
          dateKey="end_date"
          todayStr={today}
          emptyText="No departures in the next 7 days"
        />
      </div>

      {enquiries.length > 0 && (
        <WeekSection
          title="Pending — needs confirmation"
          icon={Clock}
          iconCls="text-amber-500"
          bookings={enquiries}
          dateKey="start_date"
          todayStr={today}
          emptyText=""
        />
      )}
    </div>
  )
}
