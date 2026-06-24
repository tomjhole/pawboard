import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Filter, X, Lock,
  HelpCircle, CheckCircle, AlertTriangle, ArrowRight,
  Home, Bell, CheckCheck, XCircle, Users, AlertCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { Button, PageHeader, PlanGate } from '@/components/ui'
import { usePlan } from '@/lib/plans'
import { NewBookingModal, STATUS_LABELS, computeDisplayStatus } from '@/pages/BookingsPage'
import type { DbBookingStatus } from '@/pages/BookingsPage'

// ---------- types ----------

type CalendarArea = { id: string; name: string; sort_order: number }

type CalendarSpace = {
  id: string
  name: string
  sort_order: number
  max_pets: number
  area: CalendarArea
  spaceTypeId: string | null
  spaceTypeName: string | null
  allowedPetSizes: string[] | null
  speciesIds: string[]
}

type CalendarAssignment = {
  id: string
  spaceId: string
  startDate: string
  endDate: string
  bookingId: string
  status: DbBookingStatus
  displayStatus: DbBookingStatus
  ownerName: string
  petName: string
  speciesColour: string | null
  speciesId: string | null
  speciesName: string | null
  petSize: string | null
  hasVaccination: boolean
  hasVetDetails: boolean
}

type PetSize = 'toy' | 'small' | 'medium' | 'large' | 'giant'

const PET_SIZE_LABELS: Record<PetSize, string> = {
  toy: 'Toy', small: 'Small', medium: 'Medium', large: 'Large', giant: 'Giant',
}
const ALL_PET_SIZES: PetSize[] = ['toy', 'small', 'medium', 'large', 'giant']

// ---------- filter types ----------

interface CalendarFilters {
  statuses:          Set<DbBookingStatus>
  speciesIds:        Set<string>
  areaIds:           Set<string>
  spaceTypeIds:      Set<string>
  petSizes:          Set<PetSize>
  arrivingToday:     boolean
  leavingToday:      boolean
  availableOnly:     boolean
  suitableOnly:      boolean
  vaccinationStatus: 'any' | 'verified' | 'missing'
  missingInfo:       boolean
}

const DEFAULT_FILTERS: CalendarFilters = {
  statuses: new Set(),
  speciesIds: new Set(),
  areaIds: new Set(),
  spaceTypeIds: new Set(),
  petSizes: new Set(),
  arrivingToday: false,
  leavingToday: false,
  availableOnly: false,
  suitableOnly: false,
  vaccinationStatus: 'any',
  missingInfo: false,
}

// ---------- constants ----------

const SPACE_COL_W = 148
const DAY_COL_W = 44   // minimum; actual columns flex to 1fr
const ROW_H = 52
const DAYS_SHOWN = 14

type StatusStyle = {
  stripe: string
  bg:     string
  text:   string
  border: string
  Icon:   LucideIcon
  dim?:   boolean
}

// Statuses that occupy a space and count toward capacity
const CAPACITY_STATUSES = new Set<DbBookingStatus>(['confirmed', 'checked_in', 'due_out'])

const STATUS_STYLES: Record<DbBookingStatus, StatusStyle> = {
  enquiry: {
    stripe: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-300', Icon: HelpCircle,
  },
  confirmed: {
    stripe: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', Icon: CheckCircle,
  },
  details_outstanding: {
    stripe: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300', Icon: AlertTriangle,
  },
  ready: {
    stripe: 'bg-sky-500', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200', Icon: ArrowRight,
  },
  checked_in: {
    stripe: 'bg-indigo-600', bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-300', Icon: Home,
  },
  due_out: {
    stripe: 'bg-rose-500', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-400', Icon: Bell,
  },
  checked_out: {
    stripe: 'bg-slate-300', bg: 'bg-white', text: 'text-slate-400', border: 'border-slate-200', Icon: CheckCheck, dim: true,
  },
  cancelled: {
    stripe: 'bg-red-300', bg: 'bg-white', text: 'text-red-400', border: 'border-red-200', Icon: XCircle, dim: true,
  },
  waiting_list: {
    stripe: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', Icon: Users,
  },
}

// ---------- helpers ----------

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
      day: 'numeric', month: 'short',
      year: sameYear ? undefined : 'numeric',
    })
  )
}

// ---------- FilterPanel ----------

type SpeciesOption   = { id: string; name: string; colour: string | null }
type SpaceTypeOption = { id: string; name: string }

interface FilterPanelProps {
  filters:    CalendarFilters
  onChange:   (f: CalendarFilters) => void
  species:    SpeciesOption[]
  areas:      CalendarArea[]
  spaceTypes: SpaceTypeOption[]
}

const ALL_STATUSES: DbBookingStatus[] = [
  'enquiry', 'confirmed', 'details_outstanding', 'ready',
  'checked_in', 'due_out', 'checked_out', 'cancelled', 'waiting_list',
]

function FilterPanel({ filters, onChange, species, areas, spaceTypes }: FilterPanelProps) {
  function set(updates: Partial<CalendarFilters>) {
    onChange({ ...filters, ...updates })
  }

  function toggleSetItem<T>(key: 'statuses' | 'speciesIds' | 'areaIds' | 'spaceTypeIds' | 'petSizes', value: T) {
    const s = filters[key] as unknown as Set<T>
    const next = new Set(s)
    if (next.has(value)) { next.delete(value) } else { next.add(value) }
    set({ [key]: next } as Partial<CalendarFilters>)
  }

  const chip = (active: boolean, label: string, onClick: () => void, dotColour?: string) => (
    <button
      key={label}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-700',
      ].join(' ')}
    >
      {dotColour && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColour }} />}
      {label}
    </button>
  )

  const toggleBtn = (active: boolean, label: string, onClick: () => void, disabled?: boolean) => (
    <button
      key={label}
      onClick={disabled ? undefined : onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
        disabled
          ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200'
          : active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-700',
      ].join(' ')}
    >
      <span className={[
        'w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center text-[9px]',
        active && !disabled ? 'bg-white/20 border-white/60' : 'border-current',
      ].join(' ')}>
        {active ? '✓' : ''}
      </span>
      {label}
    </button>
  )

  const filterRow = (label: string, content: React.ReactNode) => (
    <div className="flex items-start gap-3 min-w-0">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pt-1 w-16 flex-shrink-0 text-right">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5 flex-1">{content}</div>
    </div>
  )

  const suitableDisabled = filters.speciesIds.size === 0

  return (
    <div className="border border-slate-200 rounded-xl bg-white p-3 shadow-sm space-y-3">
      {/* Quick toggles */}
      <div className="flex flex-wrap gap-2">
        {toggleBtn(filters.arrivingToday, 'Arriving today',       () => set({ arrivingToday: !filters.arrivingToday }))}
        {toggleBtn(filters.leavingToday,  'Leaving today',        () => set({ leavingToday:  !filters.leavingToday  }))}
        {toggleBtn(filters.availableOnly, 'Available spaces only',() => set({ availableOnly: !filters.availableOnly }))}
        {toggleBtn(
          filters.suitableOnly, 'Suitable spaces only',
          () => set({ suitableOnly: !filters.suitableOnly }),
          suitableDisabled,
        )}
        {toggleBtn(filters.missingInfo, 'Missing information',    () => set({ missingInfo: !filters.missingInfo }))}
      </div>

      <div className="border-t border-slate-100" />

      <div className="space-y-2">
        {filterRow('Status', ALL_STATUSES.map(s =>
          chip(filters.statuses.has(s), STATUS_LABELS[s], () => toggleSetItem('statuses', s))
        ))}

        {species.length > 0 && filterRow('Species', species.map(sp =>
          chip(filters.speciesIds.has(sp.id), sp.name, () => toggleSetItem('speciesIds', sp.id), sp.colour ?? undefined)
        ))}

        {areas.length > 1 && filterRow('Area', areas.map(a =>
          chip(filters.areaIds.has(a.id), a.name, () => toggleSetItem('areaIds', a.id))
        ))}

        {spaceTypes.length > 0 && filterRow('Type', spaceTypes.map(t =>
          chip(filters.spaceTypeIds.has(t.id), t.name, () => toggleSetItem('spaceTypeIds', t.id))
        ))}

        {filterRow('Pet size', ALL_PET_SIZES.map(sz =>
          chip(filters.petSizes.has(sz), PET_SIZE_LABELS[sz], () => toggleSetItem('petSizes', sz))
        ))}
      </div>

      <div className="border-t border-slate-100" />

      {/* Vaccination + Payment */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Vaccination</span>
          <div className="flex rounded-md overflow-hidden border border-slate-200 divide-x divide-slate-200">
            {(['any', 'verified', 'missing'] as const).map(v => (
              <button
                key={v}
                onClick={() => set({ vaccinationStatus: v })}
                className={[
                  'px-2.5 py-1 text-xs font-medium transition-colors',
                  filters.vaccinationStatus === v
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {v === 'any' ? 'Any' : v === 'verified' ? 'Verified' : 'Missing'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-50" title="Payment tracking — coming in a future update">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Payment</span>
          <span className="px-2.5 py-1 rounded-md text-xs border border-dashed border-slate-300 text-slate-400 cursor-not-allowed">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------- occupancy histogram ----------

type SpeciesOccupancy = {
  speciesId: string
  speciesName: string
  speciesColour: string | null
  totalCapacity: number
  dailyOccupancy: number[]
  avgPct: number
  peakPct: number
}

function octBarColour(pct: number) {
  if (pct >= 75) return 'bg-red-500'
  if (pct >= 50) return 'bg-amber-400'
  return 'bg-emerald-500'
}

function octTextColour(pct: number) {
  if (pct >= 75) return 'text-red-700'
  if (pct >= 50) return 'text-amber-700'
  return 'text-emerald-700'
}

function octCellBg(pct: number): string {
  if (pct === 0) return ''
  if (pct >= 0.75) return 'bg-red-100'
  if (pct >= 0.5)  return 'bg-amber-100'
  if (pct >= 0.25) return 'bg-emerald-100'
  return 'bg-emerald-50'
}

function octCellText(pct: number): string {
  if (pct === 0)   return 'text-slate-300'
  if (pct >= 0.75) return 'text-red-700'
  if (pct >= 0.5)  return 'text-amber-700'
  return 'text-emerald-700'
}

const OCT_LABEL_W = 192   // left summary column width (px)
const OCT_DAY_MIN = 44    // minimum day column width (px); actual columns flex to 1fr

interface OccupancyViewProps {
  speciesOccupancy: SpeciesOccupancy[]
  days: string[]
  todayStr: string
}

function OccupancyView({ speciesOccupancy, days, todayStr }: OccupancyViewProps) {
  const gridCols = `${OCT_LABEL_W}px repeat(${days.length}, 1fr)`
  const minWidth  = OCT_LABEL_W + days.length * OCT_DAY_MIN

  if (speciesOccupancy.length === 0) {
    return (
      <div className="flex-1 min-h-0 border border-slate-200 rounded-xl flex items-center justify-center text-sm text-slate-400">
        No bookings in this date range.
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth }}>

        {/* Header row */}
        <div
          className="sticky top-0 z-10 bg-white border-b border-slate-200"
          style={{ display: 'grid', gridTemplateColumns: gridCols }}
        >
          <div className="sticky left-0 z-20 bg-white border-r border-slate-100 px-4 flex items-end pb-2 pt-3">
            <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">Species</span>
          </div>
          {days.map((d, i) => {
            const date      = new Date(d + 'T12:00:00')
            const isToday   = d === todayStr
            const dow       = date.getDay()
            const isWeekend = dow === 0 || dow === 6
            const showMonth = i === 0 || date.getDate() === 1
            return (
              <button
                key={d}
                title="View operations for this day"
                onClick={() => navigate(`/operations?date=${d}`)}
                className={[
                  'border-l border-slate-100 flex flex-col items-center pt-2.5 pb-2 gap-0.5 cursor-pointer hover:brightness-95 transition-all',
                  !isToday && isWeekend ? 'bg-slate-50/80' : '',
                ].join(' ')}
                style={isToday ? {
                  backgroundColor: 'color-mix(in srgb, var(--brand-primary) 8%, white)',
                  boxShadow: 'inset 0 3px 0 var(--brand-primary)',
                } : {}}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider leading-none"
                  style={isToday ? { color: 'var(--brand-primary)' } : { color: isWeekend ? '#94a3b8' : '#64748b' }}
                >
                  {date.toLocaleDateString('en-GB', { weekday: 'short' })}
                </span>
                <span
                  className="text-base font-bold leading-none"
                  style={isToday
                    ? { color: 'var(--brand-primary)' }
                    : { color: isWeekend ? '#94a3b8' : '#1e293b' }}
                >
                  {date.getDate()}
                </span>
                {showMonth ? (
                  <span
                    className="text-xs font-semibold leading-none"
                    style={isToday ? { color: 'var(--brand-primary)', opacity: 0.75 } : { color: '#64748b' }}
                  >
                    {date.toLocaleDateString('en-GB', { month: 'short' })}
                  </span>
                ) : (
                  <span className="text-xs leading-none opacity-0">–</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Species rows */}
        {speciesOccupancy.map(sp => (
          <div
            key={sp.speciesId}
            style={{ display: 'grid', gridTemplateColumns: gridCols }}
            className="border-b border-slate-100 last:border-b-0 group"
          >
            {/* Summary cell */}
            <div className="sticky left-0 z-10 bg-white border-r border-slate-100 px-4 py-3 group-hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                {sp.speciesColour && (
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sp.speciesColour }} />
                )}
                <span className="text-sm font-semibold text-slate-700">{sp.speciesName}</span>
                <span className={`ml-auto text-xs font-bold ${octTextColour(sp.avgPct)}`}>
                  {sp.avgPct}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full ${octBarColour(sp.avgPct)}`}
                  style={{ width: `${sp.avgPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {sp.totalCapacity} slot{sp.totalCapacity !== 1 ? 's' : ''}
                </span>
                {sp.peakPct > sp.avgPct && (
                  <span className={`text-[10px] font-medium ${octTextColour(sp.peakPct)}`}>
                    peak {sp.peakPct}%
                  </span>
                )}
              </div>
            </div>

            {/* Daily cells */}
            {sp.dailyOccupancy.map((occ, i) => {
              const day     = days[i]
              const pct     = sp.totalCapacity > 0 ? occ / sp.totalCapacity : 0
              const isToday = day === todayStr
              const dow     = new Date(day + 'T12:00:00').getDay()
              const isWeekend = dow === 0 || dow === 6
              return (
                <div
                  key={day}
                  title={`${day}: ${occ} of ${sp.totalCapacity} slots (${Math.round(pct * 100)}%)`}
                  className={[
                    'border-l border-slate-100 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors',
                    isToday ? 'bg-blue-50/40' : occ > 0 ? octCellBg(pct) : isWeekend ? 'bg-slate-50/60' : '',
                    'group-hover:brightness-95',
                  ].join(' ')}
                >
                  {occ > 0 ? (
                    <>
                      <span className={`text-sm font-bold leading-none ${octCellText(pct)}`}>{occ}</span>
                      <span className={`text-[9px] font-medium leading-none ${octCellText(pct)} opacity-70`}>
                        {Math.round(pct * 100)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-200">–</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- traffic-light helpers ----------

type DayAvailInfo = { dot: string; textCls: string; label: string; tooltip: string }

function dayAvailInfo(
  av: { totalSpaces: number; availableSpaces: number },
  hasContextFilter: boolean,
  desc: string,
): DayAvailInfo {
  const { totalSpaces, availableSpaces } = av
  const suffix = desc ? ` for ${desc}` : ''
  const suitable = hasContextFilter ? 'suitable ' : ''

  if (totalSpaces === 0) {
    return {
      dot: 'bg-slate-300', textCls: 'text-slate-400', label: '–',
      tooltip: hasContextFilter ? `No suitable spaces${suffix}` : 'No spaces configured',
    }
  }
  if (availableSpaces === 0) {
    return {
      dot: 'bg-red-500', textCls: 'text-red-600', label: 'Full',
      tooltip: `Full — all ${suitable}spaces booked${suffix}`,
    }
  }
  const ratio = availableSpaces / totalSpaces
  if (ratio <= 0.25 || availableSpaces <= 2) {
    const n = availableSpaces
    return {
      dot: 'bg-amber-400', textCls: 'text-amber-700',
      label: `${n} left`,
      tooltip: `${n} ${suitable}space${n === 1 ? '' : 's'} left${suffix}`,
    }
  }
  return {
    dot: 'bg-emerald-500', textCls: 'text-emerald-700',
    label: `${availableSpaces}`,
    tooltip: `${availableSpaces} ${suitable}space${availableSpaces === 1 ? '' : 's'} available${suffix}`,
  }
}

// ---------- SpaceRow ----------

type SpaceRowVariant = 'normal' | 'unassigned' | 'waitinglist'

interface SpaceRowProps {
  space:       CalendarSpace
  days:        string[]
  assignments: CalendarAssignment[]
  todayStr:    string
  onNavigate:  (bookingId: string) => void
  variant?:    SpaceRowVariant
}

const VARIANT_LEFT_CELL: Record<SpaceRowVariant, string> = {
  normal:      'bg-white border-slate-200 text-slate-700',
  unassigned:  'bg-slate-50 border-slate-200 text-slate-400 italic',
  waitinglist: 'bg-teal-50 border-teal-100 text-teal-700 italic',
}

function SpaceRow({ space, days, assignments, todayStr, onNavigate, variant = 'normal' }: SpaceRowProps) {
  const gridCols = `${SPACE_COL_W}px repeat(${days.length}, 1fr)`

  const { blocks, rowHeight } = useMemo(() => {
    type RawBlock = {
      id: string; bookingId: string; displayStatus: DbBookingStatus
      ownerName: string; petName: string; speciesColour: string | null
      hasVaccination: boolean
      visStart: number; visEnd: number; clipsLeft: boolean; clipsRight: boolean
      sortKey: number
    }

    const rawBlocks: RawBlock[] = assignments
      .map(a => {
        const clipsLeft  = a.startDate < days[0]
        const clipsRight = a.endDate > days[days.length - 1]
        const visStart = clipsLeft  ? 0              : days.indexOf(a.startDate)
        const visEnd   = clipsRight ? days.length - 1 : days.indexOf(a.endDate)
        if (visStart === -1 || visEnd === -1 || visEnd < visStart) return null
        return {
          id: a.id, bookingId: a.bookingId, displayStatus: a.displayStatus,
          ownerName: a.ownerName, petName: a.petName, speciesColour: a.speciesColour,
          hasVaccination: a.hasVaccination,
          visStart, visEnd, clipsLeft, clipsRight,
          sortKey: visStart * 1000 - (visEnd - visStart),
        }
      })
      .filter((x): x is RawBlock => x !== null)

    // Lane assignment using sortKey for ordering
    const sorted = [...rawBlocks].sort((a, b) => a.sortKey - b.sortKey)
    const laneEnds: number[] = []
    const laned = sorted.map(b => {
      let lane = laneEnds.findIndex(r => r <= b.visStart)
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0) }
      laneEnds[lane] = b.visEnd + 1
      return { ...b, lane }
    })

    const numLanes = Math.max(laneEnds.length, 1)
    const laneH   = Math.max(26, Math.floor((ROW_H - 8) / numLanes))
    return {
      blocks:    laned.map(b => ({ ...b, top: 4 + b.lane * laneH, blockH: laneH - 2 })),
      rowHeight: numLanes > 1 ? numLanes * laneH + 8 : ROW_H,
    }
  }, [assignments, days])

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: gridCols, minHeight: rowHeight, position: 'relative' }}
      className="border-b border-slate-100 last:border-b-0 group"
    >
      <div className={[
        'sticky left-0 z-10 flex items-center px-3 border-r text-sm font-medium transition-colors',
        VARIANT_LEFT_CELL[variant],
        variant === 'normal' ? 'group-hover:bg-slate-50/60' : '',
      ].join(' ')}>
        {space.name}
      </div>

      {days.map(d => {
        const isToday   = d === todayStr
        const dow       = new Date(d + 'T12:00:00').getDay()
        const isWeekend = dow === 0 || dow === 6
        return (
          <div
            key={d}
            className={[
              'border-l border-slate-100',
              isToday ? 'bg-blue-50/40' : isWeekend ? 'bg-slate-50/60' : '',
            ].join(' ')}
          />
        )
      })}

      {blocks.map(b => {
        const s = STATUS_STYLES[b.displayStatus] ?? STATUS_STYLES.enquiry
        const leftPad  = b.clipsLeft  ? -1 : 3
        const rightPad = b.clipsRight ?  0 : 3
        const leftStyle  = `calc(${SPACE_COL_W}px + ${b.visStart} / ${days.length} * (100% - ${SPACE_COL_W}px) + ${leftPad}px)`
        const widthStyle = `calc(${b.visEnd - b.visStart + 1} / ${days.length} * (100% - ${SPACE_COL_W}px) - ${leftPad + rightPad}px)`
        return (
          <button
            key={b.id}
            onClick={() => onNavigate(b.bookingId)}
            title={`${STATUS_LABELS[b.displayStatus]} · ${b.petName}${b.ownerName ? ' · ' + b.ownerName : ''}${!b.hasVaccination ? ' · ⚠ vaccination' : ''}`}
            style={{ position: 'absolute', left: leftStyle, top: b.top, height: b.blockH, width: widthStyle, zIndex: 5 }}
            className={[
              'flex items-stretch overflow-hidden border transition-all cursor-pointer',
              'hover:brightness-95 hover:shadow-md',
              s.dim ? 'opacity-50' : '',
              s.border,
              b.clipsLeft  ? 'rounded-l-none border-l-0' : 'rounded-md',
              b.clipsRight ? 'rounded-r-none border-r-0' : 'rounded-md',
            ].join(' ')}
          >
            {!b.clipsLeft && <div className={`w-1 flex-shrink-0 self-stretch rounded-l-md ${s.stripe}`} />}
            <div className={`flex items-center gap-1 px-1.5 flex-1 min-w-0 ${s.bg}`}>
              {b.speciesColour && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-60" style={{ backgroundColor: b.speciesColour }} />
              )}
              {!b.hasVaccination && (
                <AlertCircle className="w-2.5 h-2.5 flex-shrink-0 text-amber-500" />
              )}
              <span className={`truncate text-xs font-semibold ${s.text}`}>{b.petName}</span>
              {b.ownerName && (
                <span className={`truncate text-[10px] opacity-40 hidden sm:inline ${s.text}`}>{b.ownerName}</span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---------- CalendarPage ----------

type ViewMode = 'Grid' | 'Occupancy'
const views: ViewMode[] = ['Grid', 'Occupancy']

export default function CalendarPage() {
  const navigate = useNavigate()
  const { business } = useBusinessContext()
  const { can } = usePlan()
  const canFilters    = can('calendarFilters')
  const canOccupancy  = can('occupancyView')

  const [newOpen,      setNewOpen]      = useState(false)
  const [filtersOpen,  setFiltersOpen]  = useState(false)
  const [activeView,   setActiveView]   = useState<ViewMode>('Grid')
  const [filters,      setFilters]      = useState<CalendarFilters>(DEFAULT_FILTERS)
  const [rangeStart,   setRangeStart]   = useState(todayDate)
  const [loading,      setLoading]      = useState(true)
  const [spaces,       setSpaces]       = useState<CalendarSpace[]>([])
  const [assignments,  setAssignments]  = useState<CalendarAssignment[]>([])
  const [unassignedPets, setUnassignedPets] = useState<CalendarAssignment[]>([])

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
    const rangeEndStr   = days[days.length - 1]

    const [spacesRes, assignRes, bookingsRes] = await Promise.all([
      supabase
        .from('accommodation_spaces')
        .select(`
          id, name, sort_order, max_pets, allowed_pet_sizes,
          area:area_id(id, name, sort_order),
          space_type:space_type_id(id, name),
          accommodation_space_species(species_id)
        `)
        .eq('is_active', true)
        .order('sort_order'),

      supabase
        .from('booking_space_assignments')
        .select(`
          id, space_id, start_date, end_date,
          booking_pet:booking_pet_id (
            booking:booking_id (
              id, status,
              owner:owner_id ( first_name, last_name, email, address_line1, city, emergency_contact_name, emergency_contact_phone )
            ),
            pet:pet_id (
              name, size, vet_name, vet_practice_name, vet_phone, microchip_number,
              species:species_id ( id, name, colour ),
              vaccinations ( id, is_verified )
            )
          )
        `)
        .lte('start_date', rangeEndStr)
        .gte('end_date', rangeStartStr),

      supabase
        .from('bookings')
        .select(`
          id, status, start_date, end_date,
          owner:owner_id ( first_name, last_name, email, address_line1, city, emergency_contact_name, emergency_contact_phone ),
          booking_pets (
            id,
            booking_space_assignments ( id ),
            pet:pet_id (
              name, size, vet_name, vet_practice_name, vet_phone, microchip_number,
              species:species_id ( id, name, colour ),
              vaccinations ( id, is_verified )
            )
          )
        `)
        .lte('start_date', rangeEndStr)
        .gte('end_date', rangeStartStr),
    ])

    setSpaces(
      ((spacesRes.data ?? []) as any[]).map(s => ({
        id: s.id,
        name: s.name,
        sort_order: s.sort_order,
        max_pets: s.max_pets,
        area: s.area as CalendarArea,
        spaceTypeId:   s.space_type?.id ?? null,
        spaceTypeName: s.space_type?.name ?? null,
        allowedPetSizes: s.allowed_pet_sizes ?? null,
        speciesIds: ((s.accommodation_space_species ?? []) as any[]).map((x: any) => x.species_id),
      }))
    )

    function mapPetFlags(pet: any): { hasVaccination: boolean; hasVetDetails: boolean } {
      return {
        hasVaccination: ((pet?.vaccinations ?? []) as any[]).some((v: any) => v.is_verified),
        hasVetDetails:  !!(pet?.vet_name || pet?.vet_practice_name || pet?.vet_phone),
      }
    }

    function hasOutstanding(owner: any, pet: any): boolean {
      if (owner) {
        if (!owner.email) return true
        if (!owner.address_line1 && !owner.city) return true
        if (!owner.emergency_contact_name || !owner.emergency_contact_phone) return true
      }
      if (pet) {
        if (!pet.vet_name && !pet.vet_practice_name && !pet.vet_phone) return true
        if (!pet.microchip_number) return true
      }
      return false
    }

    const raw = (assignRes.data ?? []) as any[]
    setAssignments(raw.map(a => {
      const pet     = a.booking_pet?.pet
      const booking = a.booking_pet?.booking
      const owner   = booking?.owner
      const stored  = (booking?.status ?? 'enquiry') as DbBookingStatus
      return {
        id: a.id, spaceId: a.space_id, startDate: a.start_date, endDate: a.end_date,
        bookingId:     booking?.id ?? '',
        status:        stored,
        displayStatus: computeDisplayStatus(stored, hasOutstanding(owner, pet)),
        ownerName:     [owner?.first_name, owner?.last_name].filter(Boolean).join(' '),
        petName:       pet?.name ?? '?',
        speciesColour: pet?.species?.colour ?? null,
        speciesId:     pet?.species?.id ?? null,
        speciesName:   pet?.species?.name ?? null,
        petSize:       pet?.size ?? null,
        ...mapPetFlags(pet),
      }
    }))

    const rawBookings = (bookingsRes.data ?? []) as any[]
    const unassigned: CalendarAssignment[] = []
    for (const b of rawBookings) {
      const ownerName = [b.owner?.first_name, b.owner?.last_name].filter(Boolean).join(' ')
      const stored    = b.status as DbBookingStatus
      for (const bp of b.booking_pets ?? []) {
        if ((bp.booking_space_assignments ?? []).length === 0) {
          const pet = bp.pet
          unassigned.push({
            id: bp.id, spaceId: '__unassigned',
            startDate: b.start_date, endDate: b.end_date,
            bookingId: b.id,
            status:        stored,
            displayStatus: computeDisplayStatus(stored, hasOutstanding(b.owner, pet)),
            ownerName, petName: pet?.name ?? '?',
            speciesColour: pet?.species?.colour ?? null,
            speciesId:     pet?.species?.id ?? null,
            speciesName:   pet?.species?.name ?? null,
            petSize:       pet?.size ?? null,
            ...mapPetFlags(pet),
          })
        }
      }
    }
    setUnassignedPets(unassigned)
    setLoading(false)
  }, [business, days])

  useEffect(() => { load() }, [load])

  // ---------- derived: filter options ----------

  const availableSpecies = useMemo(() => {
    const map = new Map<string, SpeciesOption>()
    for (const a of [...assignments, ...unassignedPets]) {
      if (a.speciesId && a.speciesName && !map.has(a.speciesId)) {
        map.set(a.speciesId, { id: a.speciesId, name: a.speciesName, colour: a.speciesColour })
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [assignments, unassignedPets])

  const availableAreas = useMemo(() => {
    const map = new Map<string, CalendarArea>()
    for (const s of spaces) { if (!map.has(s.area.id)) map.set(s.area.id, s.area) }
    return [...map.values()].sort((a, b) => a.sort_order - b.sort_order)
  }, [spaces])

  const availableSpaceTypes = useMemo(() => {
    const map = new Map<string, SpaceTypeOption>()
    for (const s of spaces) {
      if (s.spaceTypeId && s.spaceTypeName) map.set(s.spaceTypeId, { id: s.spaceTypeId, name: s.spaceTypeName })
    }
    return [...map.values()]
  }, [spaces])

  // ---------- derived: occupancy ----------

  const occupancyBySpace = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of assignments) {
      if (CAPACITY_STATUSES.has(a.status)) {
        map.set(a.spaceId, (map.get(a.spaceId) ?? 0) + 1)
      }
    }
    return map
  }, [assignments])

  // ---------- derived: filtered spaces + assignments ----------

  const filteredSpaces = useMemo(() => spaces.filter(s => {
    if (filters.areaIds.size > 0 && !filters.areaIds.has(s.area.id)) return false
    if (filters.spaceTypeIds.size > 0 && !(s.spaceTypeId && filters.spaceTypeIds.has(s.spaceTypeId))) return false
    if (filters.availableOnly && (occupancyBySpace.get(s.id) ?? 0) >= s.max_pets) return false
    if (filters.suitableOnly && filters.speciesIds.size > 0 && s.speciesIds.length > 0) {
      if (!s.speciesIds.some(id => filters.speciesIds.has(id))) return false
    }
    return true
  }), [spaces, filters, occupancyBySpace])

  const { filteredAssignments, filteredUnassignedPets, filteredWaitingList } = useMemo(() => {
    function filterList(list: CalendarAssignment[]): CalendarAssignment[] {
      return list.filter(a => {
        if (filters.statuses.size > 0 && !filters.statuses.has(a.displayStatus)) return false
        if (filters.speciesIds.size > 0 && (!a.speciesId || !filters.speciesIds.has(a.speciesId))) return false
        if (filters.petSizes.size > 0 && (!a.petSize || !filters.petSizes.has(a.petSize as PetSize))) return false
        if (filters.vaccinationStatus === 'verified' && !a.hasVaccination) return false
        if (filters.vaccinationStatus === 'missing'  &&  a.hasVaccination) return false
        if (filters.missingInfo && a.hasVaccination && a.hasVetDetails) return false
        if (filters.arrivingToday || filters.leavingToday) {
          const arrivesToday = filters.arrivingToday && a.startDate === todayStr
          const leavesToday  = filters.leavingToday  && a.endDate   === todayStr
          if (!arrivesToday && !leavesToday) return false
        }
        return true
      })
    }
    const enquiryUnassigned = unassignedPets.filter(a => a.status !== 'waiting_list')
    const waitingList       = unassignedPets.filter(a => a.status === 'waiting_list')
    return {
      filteredAssignments:    filterList(assignments),
      filteredUnassignedPets: filterList(enquiryUnassigned),
      filteredWaitingList:    filterList(waitingList),
    }
  }, [assignments, unassignedPets, filters, todayStr])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.statuses.size > 0)         n++
    if (filters.speciesIds.size > 0)        n++
    if (filters.areaIds.size > 0)           n++
    if (filters.spaceTypeIds.size > 0)      n++
    if (filters.petSizes.size > 0)          n++
    if (filters.arrivingToday)              n++
    if (filters.leavingToday)               n++
    if (filters.availableOnly)              n++
    if (filters.suitableOnly)               n++
    if (filters.vaccinationStatus !== 'any') n++
    if (filters.missingInfo)                n++
    return n
  }, [filters])

  const areaGroups = useMemo(() => {
    const map = new Map<string, { area: CalendarArea; spaces: CalendarSpace[] }>()
    for (const s of filteredSpaces) {
      if (!map.has(s.area.id)) map.set(s.area.id, { area: s.area, spaces: [] })
      map.get(s.area.id)!.spaces.push(s)
    }
    return [...map.values()].sort((a, b) => a.area.sort_order - b.area.sort_order)
  }, [filteredSpaces])

  // ---------- derived: occupancy histogram ----------

  const speciesOccupancy = useMemo((): SpeciesOccupancy[] => {
    const speciesMap = new Map<string, { id: string; name: string; colour: string | null }>()
    for (const a of [...assignments, ...unassignedPets]) {
      if (a.speciesId && a.speciesName && !speciesMap.has(a.speciesId)) {
        speciesMap.set(a.speciesId, { id: a.speciesId, name: a.speciesName, colour: a.speciesColour })
      }
    }
    return [...speciesMap.values()]
      .map(sp => {
        const compatible = spaces.filter(s => s.speciesIds.length === 0 || s.speciesIds.includes(sp.id))
        const totalCapacity = compatible.length  // number of spaces, matching the availability rule
        const dailyOccupancy = days.map(day => {
          const occupied = new Set<string>()
          for (const a of assignments) {
            if (
              CAPACITY_STATUSES.has(a.status) &&
              a.speciesId === sp.id &&
              a.spaceId !== '__unassigned' &&
              a.startDate <= day &&
              a.endDate >= day
            ) {
              occupied.add(a.spaceId)
            }
          }
          return occupied.size
        })
        const peak = dailyOccupancy.reduce((m, n) => Math.max(m, n), 0)
        const avgRaw = dailyOccupancy.reduce((s, n) => s + n, 0) / Math.max(dailyOccupancy.length, 1)
        return {
          speciesId: sp.id, speciesName: sp.name, speciesColour: sp.colour,
          totalCapacity, dailyOccupancy,
          avgPct:  totalCapacity > 0 ? Math.round(avgRaw / totalCapacity * 100) : 0,
          peakPct: totalCapacity > 0 ? Math.round(peak   / totalCapacity * 100) : 0,
        }
      })
      .sort((a, b) => b.avgPct - a.avgPct)
  }, [spaces, assignments, unassignedPets, days])

  // ---------- derived: traffic-light availability ----------

  // Spaces that are compatible with the active species/size filters.
  // Used for availability counts regardless of the suitableOnly toggle state.
  const availabilitySpaces = useMemo(() => filteredSpaces.filter(s => {
    if (filters.speciesIds.size > 0 && s.speciesIds.length > 0) {
      if (!s.speciesIds.some(id => filters.speciesIds.has(id))) return false
    }
    if (filters.petSizes.size > 0 && s.allowedPetSizes && s.allowedPetSizes.length > 0) {
      if (!s.allowedPetSizes.some(sz => filters.petSizes.has(sz as PetSize))) return false
    }
    return true
  }), [filteredSpaces, filters])

  const availabilityByDay = useMemo(() => days.map(day => {
    const occupiedOnDay = new Map<string, number>()
    for (const a of assignments) {
      if (CAPACITY_STATUSES.has(a.status) && a.spaceId !== '__unassigned' && a.startDate <= day && a.endDate >= day) {
        occupiedOnDay.set(a.spaceId, (occupiedOnDay.get(a.spaceId) ?? 0) + 1)
      }
    }
    let totalSpaces = 0, availableSpaces = 0
    for (const s of availabilitySpaces) {
      const booked = occupiedOnDay.get(s.id) ?? 0
      totalSpaces++
      if (booked === 0) availableSpaces++
    }
    return { totalSpaces, availableSpaces }
  }), [days, assignments, availabilitySpaces])

  const filterDesc = useMemo(() => {
    const parts: string[] = []
    if (filters.speciesIds.size > 0) {
      parts.push(
        availableSpecies.filter(sp => filters.speciesIds.has(sp.id)).map(sp => sp.name).join('/')
      )
    }
    if (filters.petSizes.size > 0) {
      parts.push(
        ALL_PET_SIZES.filter(sz => filters.petSizes.has(sz)).map(sz => PET_SIZE_LABELS[sz].toLowerCase()).join('/') + ' size'
      )
    }
    return parts.join(', ')
  }, [filters, availableSpecies])

  function prevWeek() { setRangeStart(d => addDays(d, -7)) }
  function nextWeek() { setRangeStart(d => addDays(d, 7))  }
  function goToday()  { setRangeStart(todayDate()) }

  const gridCols = `${SPACE_COL_W}px repeat(${days.length}, 1fr)`

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Calendar"
        action={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            + New booking
          </Button>
        }
      />

      {/* Controls bar */}
      <div className="flex items-center gap-2 mb-2">
        {/* View tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {views.map(view => {
            const locked = view === 'Occupancy' && !canOccupancy
            return (
              <button
                key={view}
                onClick={() => !locked && setActiveView(view)}
                disabled={locked}
                title={locked ? 'Upgrade to PawBoard Professional to unlock occupancy view' : undefined}
                className={[
                  'px-3 py-1.5 text-sm rounded-md font-medium transition-colors flex items-center gap-1.5',
                  locked
                    ? 'text-slate-300 cursor-not-allowed'
                    : activeView === view
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {view}
                {locked && <Lock className="w-3 h-3" />}
              </button>
            )
          })}
        </div>

        <div className="flex-1" />

        {/* Filters toggle */}
        {canFilters ? (
          <>
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors',
                filtersOpen || activeFilterCount > 0
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600',
              ].join(' ')}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-indigo-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear all filters"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </>
        ) : (
          <button
            disabled
            title="Upgrade to PawBoard Professional to unlock calendar filters"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-300 cursor-not-allowed"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            <Lock className="w-3 h-3" />
          </button>
        )}

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button onClick={prevWeek} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors" aria-label="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 text-sm font-medium text-slate-700 min-w-[180px] text-center tabular-nums">
            {formatRangeLabel(days[0], days[days.length - 1])}
          </span>
          <button onClick={nextWeek} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors" aria-label="Next week">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={goToday} className="ml-1 px-3 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
            Today
          </button>
          <input
            type="date"
            value={toIso(rangeStart)}
            onChange={e => {
              const d = new Date(e.target.value + 'T12:00:00')
              if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); setRangeStart(d) }
            }}
            className="ml-1 px-2 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Jump to date"
          />
        </div>
      </div>

      {/* Filter panel */}
      {filtersOpen && canFilters && (
        <div className="mb-3">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            species={availableSpecies}
            areas={availableAreas}
            spaceTypes={availableSpaceTypes}
          />
        </div>
      )}

      {/* Occupancy view */}
      {activeView === 'Occupancy' && (
        <OccupancyView
          speciesOccupancy={speciesOccupancy}
          days={days}
          todayStr={todayStr}
        />
      )}

      {/* Calendar grid */}
      {activeView === 'Grid' && (
        <div
          className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
        <div style={{ minWidth: SPACE_COL_W + days.length * DAY_COL_W }}>
          {/* Sticky header */}
          <div
            className="sticky top-0 z-30 border-b border-slate-200 bg-white"
            style={{ display: 'grid', gridTemplateColumns: gridCols }}
          >
            {/* Space name column header */}
            <div className="sticky left-0 z-40 bg-white border-r border-slate-100 px-3 flex items-end pb-2 pt-3">
              <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">
                Space
              </span>
            </div>
            {days.map((d, i) => {
              const date      = new Date(d + 'T12:00:00')
              const isToday   = d === todayStr
              const dow       = date.getDay()
              const isWeekend = dow === 0 || dow === 6
              const showMonth = i === 0 || date.getDate() === 1
              const av        = dayAvailInfo(
                availabilityByDay[i],
                filters.speciesIds.size > 0 || filters.petSizes.size > 0,
                filterDesc,
              )
              return (
                <button
                  key={d}
                  title={`${av.tooltip} — view operations`}
                  onClick={() => navigate(`/operations?date=${d}`)}
                  className={[
                    'border-l border-slate-100 flex flex-col items-center pt-2.5 pb-2 gap-0.5 cursor-pointer hover:brightness-95 transition-all',
                    !isToday && isWeekend ? 'bg-slate-50/80' : '',
                  ].join(' ')}
                  style={isToday ? {
                    backgroundColor: 'color-mix(in srgb, var(--brand-primary) 8%, white)',
                    boxShadow: 'inset 0 3px 0 var(--brand-primary)',
                  } : {}}
                >
                  {/* Weekday */}
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider leading-none"
                    style={isToday ? { color: 'var(--brand-primary)' } : { color: isWeekend ? '#94a3b8' : '#64748b' }}
                  >
                    {date.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  {/* Date number */}
                  <span
                    className="text-base font-bold leading-none"
                    style={isToday
                      ? { color: 'var(--brand-primary)' }
                      : { color: isWeekend ? '#94a3b8' : '#1e293b' }}
                  >
                    {date.getDate()}
                  </span>
                  {/* Month label — only when it changes */}
                  {showMonth ? (
                    <span
                      className="text-xs font-semibold leading-none"
                      style={isToday ? { color: 'var(--brand-primary)', opacity: 0.75 } : { color: '#64748b' }}
                    >
                      {date.toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                  ) : (
                    <span className="text-xs leading-none opacity-0">–</span>
                  )}
                  {/* Availability */}
                  <div className="mt-0.5 flex items-center gap-0.5">
                    <span className={`w-1 h-1 rounded-full ${av.dot}`} />
                    <span className={`text-[9px] font-semibold tabular-nums ${av.textCls}`}>{av.label}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">Loading…</div>
          ) : filteredSpaces.length === 0 && filteredUnassignedPets.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">
              {spaces.length === 0 ? 'No active spaces configured.' : 'No spaces match the current filters.'}
            </div>
          ) : (
            <>
              {areaGroups.map(({ area, spaces: areaSpaces }, gi) => (
                <div key={area.id}>
                  <div
                    className={[
                      'sticky left-0 z-20 flex items-center gap-2 px-3 py-1',
                      gi > 0 ? 'border-t border-slate-100' : '',
                      'bg-white/90 backdrop-blur-sm',
                    ].join(' ')}
                    style={{ width: '100%' }}
                  >
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest whitespace-nowrap">
                      {area.name}
                    </span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  {areaSpaces.map(space => (
                    <SpaceRow
                      key={space.id}
                      space={space}
                      days={days}
                      assignments={filteredAssignments.filter(a => a.spaceId === space.id)}
                      todayStr={todayStr}
                      onNavigate={bookingId => navigate(`/bookings/${bookingId}`)}
                    />
                  ))}
                </div>
              ))}

              {/* Waiting list row */}
              {filteredWaitingList.length > 0 && (
                <div>
                  <div
                    className="sticky left-0 z-20 flex items-center gap-2 px-3 py-1 border-t border-teal-100 bg-teal-50/60"
                    style={{ width: '100%' }}
                  >
                    <span className="text-[9px] font-bold text-teal-400 uppercase tracking-widest">Waiting list</span>
                    <div className="h-px flex-1 bg-teal-100" />
                  </div>
                  <SpaceRow
                    space={{ id: '__waiting', name: 'Waiting list', sort_order: 0, max_pets: 999, spaceTypeId: null, spaceTypeName: null, allowedPetSizes: null, speciesIds: [], area: { id: '__waiting', name: 'Waiting list', sort_order: 0 } }}
                    days={days}
                    assignments={filteredWaitingList}
                    todayStr={todayStr}
                    onNavigate={bookingId => navigate(`/bookings/${bookingId}`)}
                    variant="waitinglist"
                  />
                </div>
              )}

              {/* Unassigned row */}
              {filteredUnassignedPets.length > 0 && (
                <div>
                  <div
                    className="sticky left-0 z-20 flex items-center gap-2 px-3 py-1 border-t border-slate-100 bg-slate-50/60"
                    style={{ width: '100%' }}
                  >
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Unassigned</span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  <SpaceRow
                    space={{ id: '__unassigned', name: 'Unassigned', sort_order: 0, max_pets: 999, spaceTypeId: null, spaceTypeName: null, allowedPetSizes: null, speciesIds: [], area: { id: '__unassigned', name: 'Unassigned', sort_order: 0 } }}
                    days={days}
                    assignments={filteredUnassignedPets}
                    todayStr={todayStr}
                    onNavigate={bookingId => navigate(`/bookings/${bookingId}`)}
                    variant="unassigned"
                  />
                </div>
              )}
            </>
          )}
        </div>
        </div>
      )}

      <NewBookingModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={bookingId => { setNewOpen(false); navigate(`/bookings/${bookingId}`) }}
      />
    </div>
  )
}
