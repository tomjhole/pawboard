import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  LogIn, LogOut, AlertCircle, ShieldAlert, StickyNote, ChevronRight,
  UtensilsCrossed, Dumbbell, Ban, MapPin,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { StatusBadge, Button } from '@/components/ui'
import {
  type DbBookingStatus,
  computeDisplayStatus, hasOutstandingDetails, dbStatusToUi,
} from '@/pages/BookingsPage'

// ─── Types ────────────────────────────────────────────────────────────────────

type OpVaccination = { id: string; is_verified: boolean }

type OpPet = {
  id: string
  name: string
  can_mix_with_others: boolean
  feeding_instructions: string | null
  feeds_per_day: number | null
  vet_practice_name: string | null
  vet_phone: string | null
  microchip_number: string | null
  flea_treatment_date: string | null
  flea_treatment_product: string | null
  worming_treatment_date: string | null
  worming_treatment_product: string | null
  species: { id: string; name: string; icon: string | null; colour: string | null } | null
  vaccinations: OpVaccination[]
}

type OpOwner = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  address_line1: string | null
  city: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

type OpSpace = {
  name: string
  sort_order: number
  area: { name: string; sort_order: number } | null
}

type OpSpaceAssignment = {
  start_date: string
  end_date: string
  space: OpSpace | null
}

type OpBookingPet = {
  id: string
  feeds_per_day: number | null
  feeding_instructions: string | null
  pet: OpPet | null
  booking_space_assignments: OpSpaceAssignment[]
}

type OpBooking = {
  id: string
  status: DbBookingStatus
  start_date: string
  end_date: string
  notes: string | null
  owner: OpOwner | null
  booking_pets: OpBookingPet[]
}

type Tab = 'overview' | 'care' | 'alerts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const OP_SELECT = `
  id, status, start_date, end_date, notes,
  owner:owner_id (
    id, first_name, last_name, email,
    address_line1, city,
    emergency_contact_name, emergency_contact_phone
  ),
  booking_pets (
    id, feeds_per_day, feeding_instructions,
    pet:pet_id (
      id, name, can_mix_with_others, feeding_instructions, feeds_per_day,
      vet_practice_name, vet_phone, microchip_number,
      flea_treatment_date, flea_treatment_product,
      worming_treatment_date, worming_treatment_product,
      species:species_id ( id, name, icon, colour ),
      vaccinations ( id, is_verified )
    ),
    booking_space_assignments (
      start_date, end_date,
      space:space_id (
        name, sort_order,
        area:area_id ( name, sort_order )
      )
    )
  )
`

function ownerName(b: OpBooking) {
  return b.owner ? `${b.owner.first_name} ${b.owner.last_name}` : '—'
}

function petList(b: OpBooking) {
  return b.booking_pets.map(bp => bp.pet).filter(Boolean) as OpPet[]
}

function hasVerifiedVax(pet: OpPet) {
  return pet.vaccinations.some(v => v.is_verified)
}

function daysSince(iso: string): number {
  const today = new Date(); today.setHours(12, 0, 0, 0)
  return Math.round((today.getTime() - new Date(iso + 'T12:00:00').getTime()) / 86400000)
}

const FLEA_THRESHOLD    = 30
const WORMING_THRESHOLD = 90

type TreatmentIssue = {
  kind: 'flea' | 'worming'
  issue: 'missing' | 'overdue'
  daysAgo?: number
  product?: string | null
}

function getTreatmentIssues(pet: OpPet): TreatmentIssue[] {
  const issues: TreatmentIssue[] = []
  if (!pet.flea_treatment_date) {
    issues.push({ kind: 'flea', issue: 'missing' })
  } else {
    const d = daysSince(pet.flea_treatment_date)
    if (d > FLEA_THRESHOLD) issues.push({ kind: 'flea', issue: 'overdue', daysAgo: d, product: pet.flea_treatment_product })
  }
  if (!pet.worming_treatment_date) {
    issues.push({ kind: 'worming', issue: 'missing' })
  } else {
    const d = daysSince(pet.worming_treatment_date)
    if (d > WORMING_THRESHOLD) issues.push({ kind: 'worming', issue: 'overdue', daysAgo: d, product: pet.worming_treatment_product })
  }
  return issues
}

// ─── PetAvatars ───────────────────────────────────────────────────────────────

function PetAvatars({ pets }: { pets: OpPet[] }) {
  return (
    <div className="flex -space-x-1.5 flex-shrink-0">
      {pets.slice(0, 3).map(p => (
        <div
          key={p.id}
          title={`${p.name}${p.species ? ` (${p.species.name})` : ''}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-base border-2 border-white flex-shrink-0 select-none"
          style={{ backgroundColor: p.species?.colour ? `${p.species.colour}25` : '#f1f5f9' }}
        >
          {p.species?.icon ?? '🐾'}
        </div>
      ))}
      {pets.length > 3 && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-slate-100 text-slate-500 border-2 border-white flex-shrink-0">
          +{pets.length - 3}
        </div>
      )}
    </div>
  )
}

// ─── IssueFlags ───────────────────────────────────────────────────────────────

function IssueFlags({ booking }: { booking: OpBooking }) {
  const pets = petList(booking)
  const missingDetails = hasOutstandingDetails(booking)
  const missingVax     = pets.some(p => !hasVerifiedVax(p))
  const noMixingPets   = pets.filter(p => !p.can_mix_with_others)

  if (!missingDetails && !missingVax && noMixingPets.length === 0) return null

  return (
    <div className="flex gap-1 flex-shrink-0">
      {noMixingPets.length > 0 && (
        <span
          title={`Cannot mix with other animals: ${noMixingPets.map(p => p.name).join(', ')}`}
          className="text-rose-500"
        >
          <Ban className="w-4 h-4" />
        </span>
      )}
      {missingDetails && (
        <span title="Details outstanding" className="text-amber-500">
          <AlertCircle className="w-4 h-4" />
        </span>
      )}
      {missingVax && (
        <span title="Vaccination not verified" className="text-rose-500">
          <ShieldAlert className="w-4 h-4" />
        </span>
      )}
    </div>
  )
}

// ─── BookingRow ───────────────────────────────────────────────────────────────

function BookingRow({
  booking,
  action,
  actionLoading,
  onAction,
}: {
  booking:       OpBooking
  action?:       'check_in' | 'check_out'
  actionLoading: boolean
  onAction?:     (id: string) => void
}) {
  const pets    = petList(booking)
  const display = computeDisplayStatus(booking.status, hasOutstandingDetails(booking))

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
      <PetAvatars pets={pets} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-900">{ownerName(booking)}</span>
          <IssueFlags booking={booking} />
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5" title={pets.map(p => p.name).join(', ')}>
          {pets.map(p => p.name).join(', ') || 'No pets'}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        <StatusBadge status={dbStatusToUi(display)} />
      </div>

      {action && onAction ? (
        <Button
          size="sm"
          variant={action === 'check_in' ? 'primary' : 'secondary'}
          icon={action === 'check_in'
            ? <LogIn  className="w-3.5 h-3.5" />
            : <LogOut className="w-3.5 h-3.5" />}
          loading={actionLoading}
          onClick={() => onAction(booking.id)}
        >
          {action === 'check_in' ? 'Check in' : 'Check out'}
        </Button>
      ) : (
        <Link
          to={`/bookings/${booking.id}`}
          className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}

      {action && onAction && (
        <Link
          to={`/bookings/${booking.id}`}
          className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  iconCls,
  count,
  emptyText,
  children,
}: {
  title:     string
  icon:      React.ElementType
  iconCls:   string
  count:     number
  emptyText: string
  children:  React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <Icon className={`w-4 h-4 flex-shrink-0 ${iconCls}`} />
        <h2 className="text-sm font-semibold text-slate-700 flex-1">{title}</h2>
        {count > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
            {count}
          </span>
        )}
      </div>
      {count === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-400 italic text-center">{emptyText}</p>
      ) : (
        <div>{children}</div>
      )}
    </div>
  )
}

// ─── VaxIssueRow ──────────────────────────────────────────────────────────────

function VaxIssueRow({ booking, pet }: { booking: OpBooking; pet: OpPet }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 border-2 border-rose-100 select-none"
        style={{ backgroundColor: pet.species?.colour ? `${pet.species.colour}20` : '#fff1f2' }}
      >
        {pet.species?.icon ?? '🐾'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{pet.name}</p>
        <p className="text-xs text-slate-500 truncate">
          {ownerName(booking)} · {pet.vaccinations.length === 0 ? 'No records' : 'Unverified'}
        </p>
      </div>
      <Link
        to={`/pets/${pet.id}`}
        className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline flex-shrink-0"
      >
        Update
      </Link>
      <Link
        to={`/bookings/${booking.id}`}
        className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

// ─── TreatmentIssueRow ────────────────────────────────────────────────────────

function TreatmentIssueRow({ booking, pet, issues }: { booking: OpBooking; pet: OpPet; issues: TreatmentIssue[] }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 border-2 border-amber-100 select-none mt-0.5"
        style={{ backgroundColor: pet.species?.colour ? `${pet.species.colour}20` : '#fffbeb' }}
      >
        {pet.species?.icon ?? '🐾'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-900">{pet.name}</span>
          <span className="text-xs text-slate-400 truncate">{ownerName(booking)}</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {issues.map((iss, i) => {
            const label = iss.kind === 'flea' ? 'Flea' : 'Worming'
            const text  = iss.issue === 'missing'
              ? `${label}: not recorded`
              : `${label}: ${iss.daysAgo}d overdue`
            return (
              <span key={i} className="inline-flex text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                {text}
              </span>
            )
          })}
        </div>
      </div>
      <Link
        to={`/pets/${pet.id}`}
        className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline flex-shrink-0 mt-0.5"
      >
        Update
      </Link>
      <Link
        to={`/bookings/${booking.id}`}
        className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

// ─── CareChecklist ────────────────────────────────────────────────────────────

const FEED_LABELS: Record<number, string[]> = {
  1: ['Daily'],
  2: ['AM', 'PM'],
  3: ['AM', 'Midday', 'PM'],
  4: ['AM', 'Midday', 'PM', 'Eve'],
}

function spaceForDate(bp: OpBookingPet, date: string): OpSpace | null {
  const a = bp.booking_space_assignments ?? []
  const covering = a.find(x => x.start_date <= date && date <= x.end_date)
  return (covering ?? a[0])?.space ?? null
}

function CareChecklist({
  bookings,
  careLog,
  careToggling,
  onToggle,
  dateRelation,
  selectedDate,
}: {
  bookings:     OpBooking[]
  careLog:      Set<string>
  careToggling: Set<string>
  onToggle:     (bookingPetId: string, careType: string) => void
  dateRelation: 'today' | 'past' | 'future'
  selectedDate: string
}) {
  const rows: { booking: OpBooking; bp: OpBookingPet; pet: OpPet; space: OpSpace | null }[] = []
  for (const b of bookings) {
    for (const bp of b.booking_pets) {
      if (bp.pet) rows.push({ booking: b, bp, pet: bp.pet, space: spaceForDate(bp, selectedDate) })
    }
  }

  // Order by area, then space, then pet name — matches how staff walk the site
  rows.sort((a, b) => {
    const aArea = a.space?.area?.sort_order ?? Number.MAX_SAFE_INTEGER
    const bArea = b.space?.area?.sort_order ?? Number.MAX_SAFE_INTEGER
    if (aArea !== bArea) return aArea - bArea
    const aSpace = a.space?.sort_order ?? Number.MAX_SAFE_INTEGER
    const bSpace = b.space?.sort_order ?? Number.MAX_SAFE_INTEGER
    if (aSpace !== bSpace) return aSpace - bSpace
    return a.pet.name.localeCompare(b.pet.name)
  })

  if (rows.length === 0) {
    return <p className="px-4 py-5 text-sm text-slate-400 italic text-center">No animals currently boarding</p>
  }

  return (
    <div>
      {dateRelation === 'future' && (
        <div className="mx-4 mt-3 mb-1 flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-500">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-slate-400" />
          Care checks can't be marked for future dates.
        </div>
      )}
      {dateRelation === 'past' && (
        <div className="mx-4 mt-3 mb-1 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          You're editing a past day — changes are saved but staff won't be re-notified.
        </div>
      )}
      {rows.map(({ booking, bp, pet, space }) => {
        const feedCount    = bp.feeds_per_day ?? pet.feeds_per_day ?? 2
        const feedLabels   = FEED_LABELS[feedCount] ?? FEED_LABELS[2]
        const feedsDone    = feedLabels.filter((_, i) => careLog.has(`${bp.id}:feed_${i + 1}`)).length
        const exercised    = careLog.has(`${bp.id}:exercise`)
        const instructions = bp.feeding_instructions ?? pet.feeding_instructions
        const locked       = dateRelation === 'future'
        const location     = space
          ? [space.area?.name, space.name].filter(Boolean).join(' · ')
          : null

        return (
          <div
            key={bp.id}
            className="flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0"
          >
            {/* Pet + location */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 border-2 border-white select-none mt-0.5"
                style={{ backgroundColor: pet.species?.colour ? `${pet.species.colour}25` : '#f1f5f9' }}
              >
                {pet.species?.icon ?? '🐾'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{pet.name}</span>
                  {location && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {location}
                    </span>
                  )}
                  {!pet.can_mix_with_others && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                      <Ban className="w-3 h-3" />
                      No mixing
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{ownerName(booking)}</span>
                </div>
                {instructions && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate" title={instructions}>{instructions}</p>
                )}
              </div>
            </div>

            {/* Care controls — wrap below the pet info on smaller / tablet screens */}
            <div className="flex flex-wrap items-center gap-1.5 pl-11 xl:pl-0 xl:flex-shrink-0 xl:justify-end">
              <div className="flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-slate-400" />
                {feedLabels.map((label, i) => {
                  const careType = `feed_${i + 1}`
                  const key      = `${bp.id}:${careType}`
                  const done     = careLog.has(key)
                  const busy     = careToggling.has(key)
                  return (
                    <button
                      key={label}
                      onClick={() => !locked && onToggle(bp.id, careType)}
                      disabled={busy || locked}
                      title={locked ? 'Cannot mark future dates' : `${label} feed`}
                      className={[
                        'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors',
                        done
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-700',
                        busy || locked ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      {done ? '✓' : '○'} {label}
                    </button>
                  )
                })}
                <span className="text-xs text-slate-400 ml-0.5 tabular-nums">{feedsDone}/{feedCount}</span>
              </div>

              <button
                onClick={() => !locked && onToggle(bp.id, 'exercise')}
                disabled={careToggling.has(`${bp.id}:exercise`) || locked}
                title={locked ? 'Cannot mark future dates' : 'Exercise'}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                  exercised
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-700',
                  careToggling.has(`${bp.id}:exercise`) || locked ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <Dumbbell className="w-3.5 h-3.5" />
                {exercised ? 'Done' : 'Exercise'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── DayNote ──────────────────────────────────────────────────────────────────

function DayNote({ date, businessId }: { date: string; businessId: string }) {
  const [text,      setText]      = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setText('')
    setSaveState('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    supabase
      .from('daily_notes')
      .select('note_text')
      .eq('log_date', date)
      .maybeSingle()
      .then(({ data }) => { if (data) setText((data as { note_text: string }).note_text) })
  }, [date])

  function handleChange(val: string) {
    setText(val)
    setSaveState('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaveState('saving')
      await supabase
        .from('daily_notes')
        .upsert(
          { business_id: businessId, log_date: date, note_text: val, updated_at: new Date().toISOString() },
          { onConflict: 'business_id,log_date' },
        )
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    }, 800)
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-sky-500" />
          <span className="text-sm font-semibold text-slate-700">Day note</span>
        </div>
        <span className={[
          'text-xs transition-opacity duration-300',
          saveState === 'saving' ? 'text-slate-400 opacity-100' : '',
          saveState === 'saved'  ? 'text-emerald-600 opacity-100' : '',
          saveState === 'idle'   ? 'opacity-0' : '',
        ].join(' ')}>
          {saveState === 'saving' ? 'Saving…' : 'Saved ✓'}
        </span>
      </div>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder="Staff handover note, anything unusual today…"
        rows={2}
        className="w-full px-4 py-3 text-sm text-slate-700 resize-none focus:outline-none placeholder:text-slate-300"
      />
    </div>
  )
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

type TabDef = { key: Tab; label: string; badge?: number | string; badgeCls?: string }

function TabBar({ tabs, active, onSelect }: {
  tabs:     TabDef[]
  active:   Tab
  onSelect: (key: Tab) => void
}) {
  return (
    <div className="flex border-b border-slate-200 mb-5 -mt-1">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={[
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            active === t.key
              ? 'border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
          ].join(' ')}
        >
          {t.label}
          {t.badge !== undefined && (
            <span className={[
              'text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none',
              t.badgeCls ?? (active === t.key
                ? 'bg-[color:var(--brand-primary)]/15 text-[color:var(--brand-primary)]'
                : 'bg-slate-100 text-slate-500'),
            ].join(' ')}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── OperationsPage ───────────────────────────────────────────────────────────

export default function OperationsPage() {
  const { business } = useBusinessContext()
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()

  const today        = toIsoDate(new Date())
  const selectedDate = searchParams.get('date') ?? today
  const tab          = (searchParams.get('tab') ?? 'overview') as Tab
  const isToday      = selectedDate === today

  const dateRelation: 'today' | 'past' | 'future' =
    selectedDate === today ? 'today' : selectedDate < today ? 'past' : 'future'

  const [loading,       setLoading]       = useState(true)
  const [arriving,      setArriving]      = useState<OpBooking[]>([])
  const [boarding,      setBoarding]      = useState<OpBooking[]>([])
  const [careLog,       setCareLog]       = useState<Set<string>>(new Set())
  const [careToggling,  setCareToggling]  = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!business) return
    setLoading(true)
    const [arrivingRes, boardingRes, careRes] = await Promise.all([
      supabase
        .from('bookings')
        .select(OP_SELECT)
        .eq('start_date', selectedDate)
        .not('status', 'in', '(cancelled,checked_out,checked_in,due_out,enquiry,waiting_list)')
        .order('start_date'),

      supabase
        .from('bookings')
        .select(OP_SELECT)
        .in('status', ['checked_in', 'due_out'])
        .order('end_date'),

      supabase
        .from('daily_care_log')
        .select('booking_pet_id, care_type')
        .eq('log_date', selectedDate),
    ])
    setArriving((arrivingRes.data ?? []) as unknown as OpBooking[])
    setBoarding((boardingRes.data ?? []) as unknown as OpBooking[])
    setCareLog(new Set(
      ((careRes.data ?? []) as { booking_pet_id: string; care_type: string }[])
        .map(r => `${r.booking_pet_id}:${r.care_type}`)
    ))
    setLoading(false)
  }, [business, selectedDate])

  useEffect(() => { load() }, [load])

  // ─── Navigation helpers ───────────────────────────────────────────────────

  function buildParams(date: string, t: Tab) {
    const p = new URLSearchParams()
    if (date !== today) p.set('date', date)
    if (t    !== 'overview') p.set('tab', t)
    const qs = p.toString()
    return `/operations${qs ? '?' + qs : ''}`
  }

  function goDate(date: string) { navigate(buildParams(date, tab)) }
  function goTab(t: Tab)        { navigate(buildParams(selectedDate, t), { replace: true }) }

  function offsetDate(days: number) {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + days)
    return toIsoDate(d)
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  function handleCheckIn(bookingId: string) {
    navigate(`/bookings/${bookingId}`, { state: { autoCheckin: true } })
  }

  function handleCheckOut(bookingId: string) {
    navigate(`/bookings/${bookingId}`, { state: { autoCheckout: true } })
  }

  async function toggleCare(bookingPetId: string, careType: string) {
    const key = `${bookingPetId}:${careType}`
    if (careToggling.has(key)) return
    setCareToggling(prev => new Set(prev).add(key))

    if (careLog.has(key)) {
      await supabase
        .from('daily_care_log')
        .delete()
        .eq('booking_pet_id', bookingPetId)
        .eq('log_date', selectedDate)
        .eq('care_type', careType)
      setCareLog(prev => { const n = new Set(prev); n.delete(key); return n })
    } else {
      await supabase
        .from('daily_care_log')
        .upsert(
          { business_id: business!.id, booking_pet_id: bookingPetId, log_date: selectedDate, care_type: careType },
          { onConflict: 'booking_pet_id,log_date,care_type' },
        )
      setCareLog(prev => new Set(prev).add(key))
    }

    setCareToggling(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  // ─── Derived data ─────────────────────────────────────────────────────────

  const dueOut     = useMemo(() => boarding.filter(b => b.end_date === selectedDate),  [boarding, selectedDate])
  const currentlyIn = useMemo(() => boarding.filter(b => b.end_date !== selectedDate), [boarding, selectedDate])

  const detailsOutstanding = useMemo(
    () => [...arriving, ...boarding].filter(b => hasOutstandingDetails(b)),
    [arriving, boarding],
  )

  const vaccinationIssues = useMemo(() => {
    const rows: { booking: OpBooking; pet: OpPet }[] = []
    for (const b of [...arriving, ...boarding]) {
      for (const bp of b.booking_pets) {
        if (bp.pet && !hasVerifiedVax(bp.pet)) rows.push({ booking: b, pet: bp.pet })
      }
    }
    return rows
  }, [arriving, boarding])

  const treatmentIssues = useMemo(() => {
    const rows: { booking: OpBooking; pet: OpPet; issues: TreatmentIssue[] }[] = []
    for (const b of [...arriving, ...boarding]) {
      for (const bp of b.booking_pets) {
        if (!bp.pet) continue
        const issues = getTreatmentIssues(bp.pet)
        if (issues.length > 0) rows.push({ booking: b, pet: bp.pet, issues })
      }
    }
    return rows
  }, [arriving, boarding])

  // Care completion stats (for badge)
  const careStats = useMemo(() => {
    let total = 0; let done = 0
    for (const b of boarding) {
      for (const bp of b.booking_pets) {
        if (!bp.pet) continue
        const feedCount = bp.feeds_per_day ?? bp.pet.feeds_per_day ?? 2
        total += feedCount + 1
        for (let i = 1; i <= feedCount; i++) {
          if (careLog.has(`${bp.id}:feed_${i}`)) done++
        }
        if (careLog.has(`${bp.id}:exercise`)) done++
      }
    }
    return { total, done, pending: total - done }
  }, [boarding, careLog])

  const totalAlerts = detailsOutstanding.length + vaccinationIssues.length + treatmentIssues.length

  // ─── Tab definitions ──────────────────────────────────────────────────────

  const tabs: TabDef[] = [
    {
      key:   'overview',
      label: 'Overview',
      badge: arriving.length > 0 ? arriving.length : undefined,
    },
    {
      key:      'care',
      label:    'Care',
      badge:    isToday
        ? (careStats.total === 0 ? undefined : careStats.pending === 0 ? '✓' : careStats.pending)
        : (boarding.length > 0 ? boarding.length : undefined),
      badgeCls: isToday && careStats.pending === 0 && careStats.total > 0
        ? 'bg-emerald-100 text-emerald-700'
        : undefined,
    },
    {
      key:      'alerts',
      label:    'Alerts',
      badge:    totalAlerts > 0 ? totalAlerts : undefined,
      badgeCls: totalAlerts > 0 ? 'bg-rose-100 text-rose-600' : undefined,
    },
  ]

  // ─── Date display ─────────────────────────────────────────────────────────

  const dateFormatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-12 text-sm text-slate-400 text-center">
        Loading daily operations…
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Operations</h1>
          <p className="text-sm text-slate-500 mt-0.5">{dateFormatted}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {!isToday && (
            <button
              onClick={() => goDate(today)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Today
            </button>
          )}
          <button
            onClick={() => goDate(offsetDate(-1))}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
            title="Previous day"
          >
            ‹
          </button>
          <button
            onClick={() => goDate(offsetDate(1))}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
            title="Next day"
          >
            ›
          </button>
        </div>
      </div>

      {/* Stat strip — always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Arriving',  value: arriving.length,  colour: 'text-emerald-600', onClick: () => goTab('overview') },
          { label: 'Due out',   value: dueOut.length,    colour: 'text-rose-600',    onClick: () => goTab('overview') },
          { label: 'Boarding',  value: boarding.length,  colour: 'text-indigo-600',  onClick: () => goTab('care')     },
          { label: 'Alerts',    value: totalAlerts,      colour: 'text-amber-600',   onClick: () => goTab('alerts')   },
        ].map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
          >
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-0.5 ${s.colour}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <TabBar tabs={tabs} active={tab} onSelect={goTab} />

      {/* ── Overview tab ──────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <DayNote date={selectedDate} businessId={business!.id} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section
              title={isToday ? 'Arriving today' : 'Arriving'}
              icon={LogIn}
              iconCls="text-emerald-500"
              count={arriving.length}
              emptyText="No arrivals"
            >
              {arriving.map(b => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  action="check_in"
                  actionLoading={false}
                  onAction={handleCheckIn}
                />
              ))}
            </Section>

            <Section
              title={isToday ? 'Due out today' : 'Due out'}
              icon={LogOut}
              iconCls="text-rose-500"
              count={dueOut.length}
              emptyText="No departures"
            >
              {dueOut.map(b => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  action="check_out"
                  actionLoading={false}
                  onAction={handleCheckOut}
                />
              ))}
            </Section>
          </div>

          {currentlyIn.length > 0 && (
            <Section
              title="Currently boarding"
              icon={LogIn}
              iconCls="text-indigo-500"
              count={currentlyIn.length}
              emptyText=""
            >
              {currentlyIn.map(b => (
                <BookingRow key={b.id} booking={b} actionLoading={false} />
              ))}
            </Section>
          )}
        </div>
      )}

      {/* ── Care tab ──────────────────────────────────────────────────── */}
      {tab === 'care' && (
        <Section
          title="Care checklist"
          icon={UtensilsCrossed}
          iconCls="text-emerald-600"
          count={boarding.reduce((n, b) => n + b.booking_pets.filter(bp => bp.pet).length, 0)}
          emptyText="No animals currently boarding"
        >
          <CareChecklist
            bookings={boarding}
            careLog={careLog}
            careToggling={careToggling}
            onToggle={toggleCare}
            dateRelation={dateRelation}
            selectedDate={selectedDate}
          />
        </Section>
      )}

      {/* ── Alerts tab ────────────────────────────────────────────────── */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          {totalAlerts === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center">
              <p className="text-sm text-slate-400 italic">No alerts — everything looks good</p>
            </div>
          )}

          {detailsOutstanding.length > 0 && (
            <Section
              title="Details outstanding"
              icon={AlertCircle}
              iconCls="text-amber-500"
              count={detailsOutstanding.length}
              emptyText=""
            >
              {detailsOutstanding.map(b => (
                <BookingRow key={b.id} booking={b} actionLoading={false} />
              ))}
            </Section>
          )}

          {vaccinationIssues.length > 0 && (
            <Section
              title="Vaccination issues"
              icon={ShieldAlert}
              iconCls="text-rose-500"
              count={vaccinationIssues.length}
              emptyText=""
            >
              {vaccinationIssues.map(({ booking, pet }) => (
                <VaxIssueRow key={`${booking.id}-${pet.id}`} booking={booking} pet={pet} />
              ))}
            </Section>
          )}

          {treatmentIssues.length > 0 && (
            <Section
              title="Treatment issues"
              icon={AlertCircle}
              iconCls="text-amber-500"
              count={treatmentIssues.length}
              emptyText=""
            >
              {treatmentIssues.map(({ booking, pet, issues }) => (
                <TreatmentIssueRow key={`${booking.id}-${pet.id}`} booking={booking} pet={pet} issues={issues} />
              ))}
            </Section>
          )}
        </div>
      )}

    </div>
  )
}
