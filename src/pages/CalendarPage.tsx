import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { Button, PageHeader } from '@/components/ui'
import { NewBookingModal } from '@/pages/BookingsPage'
import type { DbBookingStatus } from '@/pages/BookingsPage'

// ---------- types ----------

type CalendarArea = { id: string; name: string; sort_order: number }

type CalendarSpace = {
  id: string
  name: string
  sort_order: number
  area: CalendarArea
}

type CalendarAssignment = {
  id: string
  spaceId: string
  startDate: string
  endDate: string
  bookingId: string
  status: DbBookingStatus
  ownerName: string
  petName: string
  speciesColour: string | null
}

// ---------- constants ----------

const SPACE_COL_W = 156
const DAY_COL_W = 82
const ROW_H = 56
const DAYS_SHOWN = 14

const STATUS_BLOCK: Record<DbBookingStatus, string> = {
  enquiry:             'bg-slate-100 text-slate-700 border-slate-300',
  provisional:         'bg-amber-100 text-amber-800 border-amber-300',
  confirmed:           'bg-green-100 text-green-800 border-green-300',
  details_outstanding: 'bg-orange-100 text-orange-800 border-orange-300',
  ready:               'bg-blue-100 text-blue-800 border-blue-300',
  checked_in:          'bg-indigo-100 text-indigo-800 border-indigo-300',
  due_out:             'bg-purple-100 text-purple-800 border-purple-300',
  checked_out:         'bg-slate-50 text-slate-400 border-slate-200',
  cancelled:           'bg-red-50 text-red-500 border-red-200',
  waiting_list:        'bg-zinc-100 text-zinc-600 border-zinc-300',
}

// ---------- helpers ----------

function toIso(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function todayDate(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function formatRangeLabel(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const sameYear = s.getFullYear() === e.getFullYear()
  return (
    s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' – ' +
    e.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: sameYear ? undefined : 'numeric',
    })
  )
}

// ---------- SpaceRow component ----------

interface SpaceRowProps {
  space: CalendarSpace
  days: string[]
  assignments: CalendarAssignment[]
  todayStr: string
  onNavigate: (bookingId: string) => void
}

function SpaceRow({ space, days, assignments, todayStr, onNavigate }: SpaceRowProps) {
  const gridCols = `${SPACE_COL_W}px repeat(${days.length}, ${DAY_COL_W}px)`

  const blocks = useMemo(
    () =>
      assignments
        .map(a => {
          const visStart =
            a.startDate < days[0] ? 0 : days.indexOf(a.startDate)
          const visEnd =
            a.endDate > days[days.length - 1]
              ? days.length - 1
              : days.indexOf(a.endDate)
          if (visStart === -1 || visEnd === -1 || visEnd < visStart) return null
          return {
            ...a,
            left: SPACE_COL_W + visStart * DAY_COL_W + 3,
            width: (visEnd - visStart + 1) * DAY_COL_W - 6,
            clipsLeft: a.startDate < days[0],
            clipsRight: a.endDate > days[days.length - 1],
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [assignments, days],
  )

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        minHeight: ROW_H,
        position: 'relative',
      }}
      className="border-b border-slate-100 last:border-b-0 group"
    >
      {/* Space name — sticky left */}
      <div className="sticky left-0 z-10 flex items-center px-3 bg-white border-r border-slate-200 text-sm font-medium text-slate-700 group-hover:bg-slate-50/60 transition-colors">
        {space.name}
      </div>

      {/* Day background cells */}
      {days.map((d, i) => {
        const isToday = d === todayStr
        const dow = new Date(d + 'T12:00:00').getDay()
        const isWeekend = dow === 0 || dow === 6
        return (
          <div
            key={d}
            className={[
              'border-l border-slate-100',
              isToday
                ? 'bg-indigo-50/50'
                : isWeekend
                ? 'bg-slate-50/70'
                : '',
            ].join(' ')}
          />
        )
      })}

      {/* Booking blocks — absolutely positioned */}
      {blocks.map(b => {
        const colours = STATUS_BLOCK[b.status] ?? STATUS_BLOCK.enquiry
        return (
          <button
            key={b.id}
            onClick={() => onNavigate(b.bookingId)}
            title={`${b.petName} · ${b.ownerName}`}
            style={{
              position: 'absolute',
              left: b.left,
              top: 5,
              bottom: 5,
              width: b.width,
              zIndex: 5,
            }}
            className={[
              'flex items-center gap-1.5 px-2 border text-xs font-medium',
              'overflow-hidden hover:opacity-90 hover:shadow-sm transition-all cursor-pointer',
              colours,
              b.clipsLeft ? 'rounded-l-none border-l-0' : 'rounded-l-md',
              b.clipsRight ? 'rounded-r-none border-r-0' : 'rounded-r-md',
            ].join(' ')}
          >
            {b.speciesColour && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 opacity-80"
                style={{ backgroundColor: b.speciesColour }}
              />
            )}
            <span className="truncate font-semibold">{b.petName}</span>
            {b.ownerName && (
              <span className="truncate opacity-50 hidden sm:inline">{b.ownerName}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------- CalendarPage ----------

const views = ['Grid', 'Week', 'Day', 'Occupancy']

export default function CalendarPage() {
  const navigate = useNavigate()
  const { business } = useBusinessContext()
  const [newOpen, setNewOpen] = useState(false)
  const [rangeStart, setRangeStart] = useState(todayDate)
  const [loading, setLoading] = useState(true)
  const [spaces, setSpaces] = useState<CalendarSpace[]>([])
  const [assignments, setAssignments] = useState<CalendarAssignment[]>([])

  const days = useMemo(() => {
    const result: string[] = []
    for (let i = 0; i < DAYS_SHOWN; i++) result.push(toIso(addDays(rangeStart, i)))
    return result
  }, [rangeStart])

  const todayStr = useMemo(() => toIso(todayDate()), [])

  const load = useCallback(async () => {
    if (!business) return
    setLoading(true)
    const rangeStartStr = days[0]
    const rangeEndStr = days[days.length - 1]

    const [spacesRes, assignRes] = await Promise.all([
      supabase
        .from('accommodation_spaces')
        .select('id, name, sort_order, area:area_id(id, name, sort_order)')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('booking_space_assignments')
        .select(`
          id, space_id, start_date, end_date,
          booking_pet:booking_pet_id (
            booking:booking_id ( id, status, owner:owner_id ( first_name, last_name ) ),
            pet:pet_id ( name, species:species_id ( colour ) )
          )
        `)
        .lte('start_date', rangeEndStr)
        .gte('end_date', rangeStartStr),
    ])

    setSpaces((spacesRes.data ?? []) as unknown as CalendarSpace[])

    const raw = (assignRes.data ?? []) as any[]
    setAssignments(
      raw.map(a => ({
        id: a.id,
        spaceId: a.space_id,
        startDate: a.start_date,
        endDate: a.end_date,
        bookingId: a.booking_pet?.booking?.id ?? '',
        status: (a.booking_pet?.booking?.status ?? 'enquiry') as DbBookingStatus,
        ownerName: [
          a.booking_pet?.booking?.owner?.first_name,
          a.booking_pet?.booking?.owner?.last_name,
        ]
          .filter(Boolean)
          .join(' '),
        petName: a.booking_pet?.pet?.name ?? '?',
        speciesColour: a.booking_pet?.pet?.species?.colour ?? null,
      })),
    )

    setLoading(false)
  }, [business, days])

  useEffect(() => {
    load()
  }, [load])

  const areaGroups = useMemo(() => {
    const map = new Map<string, { area: CalendarArea; spaces: CalendarSpace[] }>()
    for (const s of spaces) {
      if (!map.has(s.area.id)) map.set(s.area.id, { area: s.area, spaces: [] })
      map.get(s.area.id)!.spaces.push(s)
    }
    return [...map.values()].sort((a, b) => a.area.sort_order - b.area.sort_order)
  }, [spaces])

  function prevWeek() {
    setRangeStart(d => addDays(d, -7))
  }
  function nextWeek() {
    setRangeStart(d => addDays(d, 7))
  }
  function goToday() {
    setRangeStart(todayDate())
  }

  const totalWidth = SPACE_COL_W + days.length * DAY_COL_W
  const gridCols = `${SPACE_COL_W}px repeat(${days.length}, ${DAY_COL_W}px)`

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Booking Calendar"
        description="Visual booking diary — spaces × dates"
        action={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            + New booking
          </Button>
        }
      />

      {/* Controls bar */}
      <div className="flex items-center gap-2 mb-4">
        {/* View tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {views.map((view, i) => (
            <button
              key={view}
              className={[
                'px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
                i === 0
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {view}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 text-sm font-medium text-slate-700 min-w-[180px] text-center tabular-nums">
            {formatRangeLabel(days[0], days[days.length - 1])}
          </span>
          <button
            onClick={nextWeek}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            className="ml-1 px-3 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div
        className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ minWidth: totalWidth }}>
          {/* Sticky header row */}
          <div
            className="sticky top-0 z-30 border-b border-slate-200 bg-white"
            style={{ display: 'grid', gridTemplateColumns: gridCols }}
          >
            <div className="sticky left-0 z-40 bg-white border-r border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-end pb-2.5">
              Space
            </div>

            {days.map(d => {
              const date = new Date(d + 'T12:00:00')
              const isToday = d === todayStr
              const dow = date.getDay()
              const isWeekend = dow === 0 || dow === 6
              return (
                <div
                  key={d}
                  className={[
                    'border-l border-slate-200 px-1 py-1.5 text-center',
                    isToday
                      ? 'bg-indigo-50'
                      : isWeekend
                      ? 'bg-slate-50'
                      : '',
                  ].join(' ')}
                >
                  <div className="text-[10px] font-medium text-slate-400 uppercase leading-tight">
                    {date.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </div>
                  <div
                    className={[
                      'text-sm font-bold leading-tight',
                      isToday ? 'text-indigo-600' : 'text-slate-700',
                    ].join(' ')}
                  >
                    {date.getDate()}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {date.toLocaleDateString('en-GB', { month: 'short' })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">
              Loading…
            </div>
          ) : spaces.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">
              No active spaces configured.
            </div>
          ) : (
            <>
              {areaGroups.map(({ area, spaces: areaSpaces }) => (
                <div key={area.id}>
                  {/* Area header */}
                  <div
                    className="sticky left-0 px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-t border-slate-200"
                    style={{ width: '100%' }}
                  >
                    {area.name}
                  </div>

                  {/* Space rows */}
                  {areaSpaces.map(space => (
                    <SpaceRow
                      key={space.id}
                      space={space}
                      days={days}
                      assignments={assignments.filter(a => a.spaceId === space.id)}
                      todayStr={todayStr}
                      onNavigate={bookingId => navigate(`/bookings/${bookingId}`)}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <NewBookingModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={bookingId => {
          setNewOpen(false)
          navigate(`/bookings/${bookingId}`)
        }}
      />
    </div>
  )
}
