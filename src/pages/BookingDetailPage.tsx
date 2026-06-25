import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { Pencil, Trash2, AlertCircle, CheckCircle, AlertTriangle, LogIn, LogOut, Ban, Undo2, Users, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { AuditLog } from '@/components/AuditLog'
import { useBusinessContext } from '@/context/BusinessContext'
import { canDestructiveAction } from '@/lib/roles'
import { usePlan } from '@/lib/plans'
import { PageHeader, Card, Button, Modal, Input, Textarea, StatusBadge } from '@/components/ui'
import {
  type DbBookingStatus, type SpaceWithSpecies,
  computeDisplayStatus, dbStatusToUi, formatBookingDate, SPACES_QUERY,
  petHasCriticalIssues,
} from '@/pages/BookingsPage'
import BookingPricing from '@/components/BookingPricing'
import BookingPayments from '@/components/BookingPayments'
import StayJournal from '@/components/StayJournal'
import { loadOutstanding } from '@/lib/payments'
import { fmtMoney } from '@/lib/reports'
import { printBookingReceipt } from '@/lib/receipt'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingDetail = {
  id: string
  business_id: string
  status: DbBookingStatus
  start_date: string
  end_date: string
  notes: string | null
  source: string
  created_at: string
  checked_in_at: string | null
  checked_out_at: string | null
  owner: {
    id: string
    first_name: string
    last_name: string
    phone: string
    email: string | null
    address_line1: string | null
    city: string | null
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
  } | null
  booking_pets: {
    id: string
    feeding_instructions: string | null
    medication_notes: string | null
    notes: string | null
    feeds_per_day: number | null
    pet: {
      id: string
      name: string
      breed: string | null
      size: string | null
      can_mix_with_others: boolean
      feeds_per_day: number | null
      behaviour_notes: string | null
      feeding_instructions: string | null
      medical_notes: string | null
      vet_practice_name: string | null
      vet_phone: string | null
      microchip_number: string | null
      flea_treatment_date: string | null
      flea_treatment_product: string | null
      worming_treatment_date: string | null
      worming_treatment_product: string | null
      species: { id: string; name: string; icon: string | null; colour: string | null } | null
      vaccinations: { id: string; is_verified: boolean }[]
    } | null
    booking_space_assignments: {
      id: string
      space: { id: string; name: string; area_id: string | null } | null
    }[]
  }[]
}

type MissingItem = { label: string; href?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  const today = new Date(); today.setHours(12, 0, 0, 0)
  return Math.round((today.getTime() - new Date(iso + 'T12:00:00').getTime()) / 86400000)
}

function nightsBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000
  )
}

function computeMissing(booking: BookingDetail): { critical: MissingItem[]; advisory: MissingItem[] } {
  const critical: MissingItem[] = []
  const advisory: MissingItem[] = []
  const owner = booking.owner

  if (owner && (!owner.emergency_contact_name || !owner.emergency_contact_phone))
    advisory.push({ label: `Emergency contact missing for ${owner.first_name}`, href: `/owners/${owner.id}` })

  for (const bp of booking.booking_pets) {
    const pet = bp.pet
    if (!pet) continue

    if ((booking.status === 'enquiry' || booking.status === 'waiting_list') && !bp.booking_space_assignments[0]?.space)
      critical.push({ label: `No space assigned for ${pet.name} — use the space selector in Pets below` })

    if (!pet.vet_practice_name && !pet.vet_phone)
      advisory.push({ label: `Vet details not recorded for ${pet.name}`, href: `/pets/${pet.id}` })
    if (!pet.microchip_number)
      advisory.push({ label: `Microchip number not recorded for ${pet.name}`, href: `/pets/${pet.id}` })

    if (!pet.vaccinations.some(v => v.is_verified))
      critical.push({ label: `No verified vaccinations for ${pet.name}`, href: `/pets/${pet.id}` })
    if (!pet.flea_treatment_date)
      critical.push({ label: `No flea treatment on record for ${pet.name}`, href: `/pets/${pet.id}` })
    else if (daysSince(pet.flea_treatment_date) > 30)
      critical.push({ label: `Flea treatment overdue for ${pet.name} — ${daysSince(pet.flea_treatment_date)} days ago`, href: `/pets/${pet.id}` })
    if (!pet.worming_treatment_date)
      critical.push({ label: `No worming treatment on record for ${pet.name}`, href: `/pets/${pet.id}` })
    else if (daysSince(pet.worming_treatment_date) > 90)
      critical.push({ label: `Worming overdue for ${pet.name} — ${daysSince(pet.worming_treatment_date)} days ago`, href: `/pets/${pet.id}` })
  }
  return { critical, advisory }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</p>
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-4 py-1.5">
      <dt className="text-sm text-slate-500 w-36 flex-shrink-0">{label}</dt>
      <dd className="text-sm text-slate-900 min-w-0 break-words">{value}</dd>
    </div>
  )
}

function CriticalPanel({ items }: { items: MissingItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-rose-800">
          {items.length} critical issue{items.length !== 1 ? 's' : ''} — booking cannot be confirmed until resolved
        </p>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 mt-1.5" />
            {item.href ? (
              <Link to={item.href} className="text-sm text-rose-800 hover:text-rose-900 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="text-sm text-rose-800">{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function AdvisoryPanel({ items }: { items: MissingItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-800">
          {items.length} item{items.length !== 1 ? 's' : ''} worth noting
        </p>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
            {item.href ? (
              <Link to={item.href} className="text-sm text-amber-800 hover:text-amber-900 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="text-sm text-amber-800">{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Edit booking modal ───────────────────────────────────────────────────────

interface EditForm {
  startDate: string
  endDate:   string
  notes:     string
}

interface EditModalProps {
  open: boolean
  booking: BookingDetail
  onClose: () => void
  onSave: (form: EditForm) => Promise<void>
}

function EditBookingModal({ open, booking, onClose, onSave }: EditModalProps) {
  const [form,   setForm]   = useState<EditForm>({
    startDate: booking.start_date,
    endDate:   booking.end_date,
    notes:     booking.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm({ startDate: booking.start_date, endDate: booking.end_date, notes: booking.notes ?? '' })
      setErrors({})
    }
  }, [open, booking])

  function setField<K extends keyof EditForm>(k: K, v: EditForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  async function handleSave() {
    const errs: Record<string, string> = {}
    if (!form.startDate) errs.startDate = 'Arrival date is required'
    if (!form.endDate)   errs.endDate = 'Departure date is required'
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      errs.endDate = 'Departure must be on or after arrival'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit booking"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.general && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            {errors.general}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            id="eb-start"
            label="Arrival date"
            type="date"
            value={form.startDate}
            onChange={e => setField('startDate', e.target.value)}
            required
            error={errors.startDate}
          />
          <Input
            id="eb-end"
            label="Departure date"
            type="date"
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={e => setField('endDate', e.target.value)}
            required
            error={errors.endDate}
          />
        </div>

        <Textarea
          id="eb-notes"
          label="Notes"
          value={form.notes}
          onChange={e => setField('notes', e.target.value)}
          rows={3}
        />
      </div>
    </Modal>
  )
}

// ─── Per-pet space selector ───────────────────────────────────────────────────

interface PetSpaceSelectProps {
  bp: BookingDetail['booking_pets'][number]
  spaces: SpaceWithSpecies[]
  booking: BookingDetail
  onChanged: () => void
}

function PetSpaceSelect({ bp, spaces, booking, onChanged }: PetSpaceSelectProps) {
  const [saving,      setSaving]      = useState(false)
  const [spaceError,  setSpaceError]  = useState<string | null>(null)
  const [occupancyMap, setOccupancyMap] = useState<Map<string, number>>(new Map())

  const currentAssignment = bp.booking_space_assignments[0] ?? null
  const currentSpaceId    = currentAssignment?.space?.id ?? ''
  const petSpeciesId      = bp.pet?.species?.id ?? ''
  const petSpeciesName    = bp.pet?.species?.name ?? ''

  // Fetch how many OTHER confirmed/active bookings occupy each space for these dates.
  // Excludes the current booking so the already-assigned space isn't shown as unavailable.
  useEffect(() => {
    supabase
      .from('bookings')
      .select('id, booking_pets(booking_space_assignments(id, space_id))')
      .in('status', ['confirmed', 'checked_in', 'due_out'])
      .neq('id', booking.id)
      .lte('start_date', booking.end_date)
      .gte('end_date', booking.start_date)
      .then(({ data }) => {
        const map = new Map<string, number>()
        for (const b of data ?? []) {
          for (const bpRow of (b as any).booking_pets ?? []) {
            for (const sa of bpRow.booking_space_assignments ?? []) {
              map.set(sa.space_id, (map.get(sa.space_id) ?? 0) + 1)
            }
          }
        }
        setOccupancyMap(map)
      })
  }, [booking.start_date, booking.end_date, currentAssignment?.id])

  const speciesMatch = (s: SpaceWithSpecies) =>
    !petSpeciesId || s.accommodation_space_species.some(ss => ss.species_id === petSpeciesId)

  const compatibleSpaces   = spaces.filter(s =>  speciesMatch(s))
  const incompatibleSpaces = spaces.filter(s => !speciesMatch(s))

  const availableSpaces    = compatibleSpaces.filter(s =>
    s.id === currentSpaceId || (occupancyMap.get(s.id) ?? 0) < s.max_pets
  )
  const fullyBookedSpaces  = compatibleSpaces.filter(s =>
    s.id !== currentSpaceId && (occupancyMap.get(s.id) ?? 0) >= s.max_pets
  )

  const spacesByArea = useMemo(() => {
    const groups = new Map<string, { areaName: string; spaces: SpaceWithSpecies[] }>()
    for (const s of availableSpaces) {
      const areaId   = s.area?.id   ?? '__none'
      const areaName = s.area?.name ?? 'Ungrouped'
      if (!groups.has(areaId)) groups.set(areaId, { areaName, spaces: [] })
      groups.get(areaId)!.spaces.push(s)
    }
    return [...groups.values()]
  }, [availableSpaces])

  async function handleChange(newSpaceId: string) {
    setSpaceError(null)

    // Species compatibility check
    if (newSpaceId && petSpeciesId) {
      const space = spaces.find(s => s.id === newSpaceId)
      if (space && !speciesMatch(space)) {
        setSpaceError(`${space.name} does not accept ${petSpeciesName}. Choose a compatible space.`)
        return
      }
    }

    // Occupancy check — re-query at save time for freshness
    if (newSpaceId) {
      const space = spaces.find(s => s.id === newSpaceId)
      if (space) {
        let query = supabase
          .from('booking_space_assignments')
          .select('id')
          .eq('space_id', newSpaceId)
          .lte('start_date', booking.end_date)
          .gte('end_date', booking.start_date)
        if (currentAssignment) {
          query = query.neq('id', currentAssignment.id)
        }
        const { data: existing } = await query
        if ((existing?.length ?? 0) >= space.max_pets) {
          setSpaceError(`${space.name} is already fully booked for these dates.`)
          return
        }
      }
    }

    setSaving(true)
    try {
      if (currentAssignment) {
        if (newSpaceId) {
          const { error } = await supabase
            .from('booking_space_assignments')
            .update({ space_id: newSpaceId })
            .eq('id', currentAssignment.id)
          if (error) throw new Error(error.message)
        } else {
          const { error } = await supabase
            .from('booking_space_assignments')
            .delete()
            .eq('id', currentAssignment.id)
          if (error) throw new Error(error.message)
        }
      } else if (newSpaceId) {
        const { error } = await supabase
          .from('booking_space_assignments')
          .insert({
            booking_pet_id: bp.id,
            space_id:       newSpaceId,
            business_id:    booking.business_id,
            start_date:     booking.start_date,
            end_date:       booking.end_date,
          })
        if (error) throw new Error(error.message)
      }
      const prevSpaceName = currentAssignment?.space?.name ?? null
      const newSpaceName  = newSpaceId ? (spaces.find(s => s.id === newSpaceId)?.name ?? null) : null
      await logAudit(booking.business_id, {
        action:      'space_assignment.changed',
        entity_type: 'booking',
        entity_id:   booking.id,
        before: { space: prevSpaceName },
        after:  { space: newSpaceName },
        meta:   { pet_name: bp.pet?.name ?? null },
      })
      onChanged()
    } catch (err) {
      setSpaceError(err instanceof Error ? err.message : 'Failed to update space')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <select
          value={currentSpaceId}
          onChange={e => handleChange(e.target.value)}
          disabled={saving}
          className={[
            'w-full pl-3 pr-7 py-1.5 text-xs bg-white rounded-md border appearance-none transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            spaceError ? 'border-red-400' : 'border-slate-300 text-slate-700',
          ].join(' ')}
        >
          <option value="">No space — assign later</option>
          {spacesByArea.map(group => (
            <optgroup key={group.areaName} label={group.areaName}>
              {group.spaces.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </optgroup>
          ))}
          {fullyBookedSpaces.length > 0 && (
            <optgroup label="⚠ Already booked these dates">
              {fullyBookedSpaces.map(s => (
                <option key={s.id} value={s.id} disabled>{s.name}</option>
              ))}
            </optgroup>
          )}
          {incompatibleSpaces.length > 0 && (
            <optgroup label="⚠ Incompatible species">
              {incompatibleSpaces.map(s => (
                <option key={s.id} value={s.id} disabled>{s.name}</option>
              ))}
            </optgroup>
          )}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          <svg className="w-3 h-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      {spaceError && (
        <p className="text-xs text-red-600 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          {spaceError}
        </p>
      )}
    </div>
  )
}

// ─── BookingDetailPage ────────────────────────────────────────────────────────

// Statuses where the booking has not yet reached an operational event
const PRE_EVENT_STATUSES = new Set<DbBookingStatus>([
  'enquiry', 'confirmed', 'waiting_list', 'details_outstanding', 'ready',
])

function StatusActionBar({
  booking,
  actionLoading,
  confirmCancel,
  confirmBlocked,
  canCancel,
  onCheckIn,
  onCheckOut,
  onConfirm,
  onToWaitingList,
  onCancelRequest,
  onCancelConfirm,
  onCancelAbort,
  onRestore,
  onRecheckIn,
}: {
  booking:         BookingDetail
  actionLoading:   'check_in' | 'check_out' | 'cancel' | 'restore' | 'recheckin' | 'confirm' | 'waiting_list' | null
  confirmCancel:   boolean
  confirmBlocked:  boolean
  canCancel?:      boolean
  onCheckIn:       () => void
  onCheckOut:      () => void
  onConfirm:       () => void
  onToWaitingList: () => void
  onCancelRequest: () => void
  onCancelConfirm: () => void
  onCancelAbort:   () => void
  onRestore:       () => void
  onRecheckIn:     () => void
}) {
  const { status } = booking

  if (status === 'checked_out') {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
        <Button
          variant="secondary"
          icon={<Undo2 className="w-4 h-4" />}
          onClick={onRecheckIn}
          loading={actionLoading === 'recheckin'}
        >
          Re-check in
        </Button>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
        <Button
          variant="secondary"
          icon={<Undo2 className="w-4 h-4" />}
          onClick={onRestore}
          loading={actionLoading === 'restore'}
        >
          Restore booking
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
      {(status === 'checked_in' || status === 'due_out') && (
        <Button
          icon={<LogOut className="w-4 h-4" />}
          onClick={onCheckOut}
          loading={actionLoading === 'check_out'}
        >
          Check out
        </Button>
      )}

      {(PRE_EVENT_STATUSES.has(status) && status !== 'waiting_list' && status !== 'enquiry') && (
        <Button
          icon={<LogIn className="w-4 h-4" />}
          onClick={onCheckIn}
          loading={actionLoading === 'check_in'}
        >
          Check in
        </Button>
      )}

      {(status === 'enquiry' || status === 'waiting_list') && (
        <Button
          variant="secondary"
          icon={<CheckCircle className="w-4 h-4" />}
          onClick={onConfirm}
          loading={actionLoading === 'confirm'}
          disabled={confirmBlocked}
          title={confirmBlocked ? 'Resolve critical issues above before confirming' : undefined}
        >
          Confirm booking
        </Button>
      )}

      {status === 'enquiry' && (
        <Button
          variant="secondary"
          icon={<Users className="w-4 h-4" />}
          onClick={onToWaitingList}
          loading={actionLoading === 'waiting_list'}
        >
          Waiting list
        </Button>
      )}

      {canCancel !== false && (!confirmCancel ? (
        <Button
          variant="secondary"
          icon={<Ban className="w-4 h-4" />}
          onClick={onCancelRequest}
          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
        >
          Cancel booking
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Cancel this booking?</span>
          <Button
            variant="danger"
            onClick={onCancelConfirm}
            loading={actionLoading === 'cancel'}
          >
            Yes, cancel
          </Button>
          <Button variant="secondary" onClick={onCancelAbort} disabled={actionLoading === 'cancel'}>
            Keep
          </Button>
        </div>
      ))}
    </div>
  )
}

// ─── CheckInModal ─────────────────────────────────────────────────────────────

type PetNoteState = { feeding: string; medication: string; feedsPerDay: number }

function CheckItem({ ok, label, href }: { ok: boolean; label: string; href?: string }) {
  const icon = ok
    ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
    : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
  return (
    <div className="flex items-center gap-2.5 py-1">
      {icon}
      <span className={`text-sm flex-1 ${ok ? 'text-slate-700' : 'text-amber-700'}`}>{label}</span>
      {!ok && href && (
        <Link to={href} className="text-xs font-medium text-amber-600 hover:underline flex-shrink-0">
          Update →
        </Link>
      )}
    </div>
  )
}

function CheckInModal({ open, booking, onClose, onConfirm }: {
  open:      boolean
  booking:   BookingDetail
  onClose:   () => void
  onConfirm: (petNotes: Record<string, PetNoteState>) => Promise<void>
}) {
  const [petNotes, setPetNotes] = useState<Record<string, PetNoteState>>({})
  const [handover, setHandover] = useState<Record<string, boolean>>({})
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!open) return
    const notes: Record<string, PetNoteState> = {}
    for (const bp of booking.booking_pets) {
      notes[bp.id] = {
        feeding:     bp.feeding_instructions ?? bp.pet?.feeding_instructions ?? '',
        medication:  bp.medication_notes ?? '',
        feedsPerDay: bp.feeds_per_day ?? bp.pet?.feeds_per_day ?? 2,
      }
    }
    setPetNotes(notes)
    setHandover({})
    setSaving(false)
  }, [open, booking])

  const today = new Date().toISOString().split('T')[0]
  const dateWarning = today < booking.start_date
    ? `Checking in early — booking starts ${formatBookingDate(booking.start_date)}`
    : today > booking.start_date
    ? `Late check-in — booking was due ${formatBookingDate(booking.start_date)}`
    : null

  const owner = booking.owner
  const ownerChecks = [
    { label: 'Emergency contact', ok: !!(owner?.emergency_contact_name && owner?.emergency_contact_phone), href: owner ? `/owners/${owner.id}` : undefined },
  ]

  // Per-pet health warnings split by severity
  const criticalHealthWarnings = booking.booking_pets.flatMap(bp => {
    const pet = bp.pet; if (!pet) return []
    return [
      !pet.vaccinations.some(v => v.is_verified)                              && `${pet.name}: no verified vaccinations`,
      (!pet.flea_treatment_date || daysSince(pet.flea_treatment_date) > 30)   && `${pet.name}: flea treatment ${!pet.flea_treatment_date ? 'not recorded' : 'overdue'}`,
      (!pet.worming_treatment_date || daysSince(pet.worming_treatment_date) > 90) && `${pet.name}: worming ${!pet.worming_treatment_date ? 'not recorded' : 'overdue'}`,
    ].filter((v): v is string => !!v)
  })

  const totalAdvisoryWarnings = [
    ...ownerChecks.filter(c => !c.ok),
    ...booking.booking_pets.flatMap(bp => {
      const pet = bp.pet; if (!pet) return []
      return [
        (!pet.vet_practice_name && !pet.vet_phone),
        !pet.microchip_number,
      ].filter(Boolean)
    }),
  ].length

  const handoverItems = [
    { key: 'feeding',    label: 'Feeding instructions confirmed with owner' },
    { key: 'meds',       label: 'Medication discussed and handed over' },
    { key: 'behaviour',  label: 'Behaviour / temperament noted' },
    { key: 'belongings', label: 'Belongings labelled (bed, food, toys)' },
    { key: 'consent',    label: 'Owner consent to emergency vet treatment confirmed' },
    { key: 'deposit',    label: 'Deposit / payment arranged' },
  ]

  async function handleConfirm() {
    setSaving(true)
    try { await onConfirm(petNotes) } finally { setSaving(false) }
  }

  function setPetField(bpId: string, field: keyof PetNoteState, value: string | number) {
    setPetNotes(prev => ({ ...prev, [bpId]: { ...prev[bpId], [field]: value } }))
  }

  const ownerName = owner ? `${owner.first_name} ${owner.last_name}` : 'Unknown owner'
  const petNames  = booking.booking_pets.map(bp => bp.pet?.name).filter(Boolean).join(', ')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Check in — ${ownerName}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} loading={saving} icon={<LogIn className="w-4 h-4" />}>
            Complete check-in
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {petNames && (
          <p className="text-sm text-slate-500">Pets: <span className="font-medium text-slate-700">{petNames}</span></p>
        )}

        {dateWarning && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium">{dateWarning}</p>
          </div>
        )}

        {booking.booking_pets.some(bp => bp.pet && !bp.pet.can_mix_with_others) && (
          <div className="rounded-lg bg-rose-50 border border-rose-300 px-3.5 py-2.5 flex items-start gap-2.5">
            <Ban className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-800">
                {booking.booking_pets.filter(bp => bp.pet && !bp.pet.can_mix_with_others).map(bp => bp.pet!.name).join(', ')}
                {' '}cannot mix with other animals
              </p>
              <p className="text-xs text-rose-700 mt-0.5">Ensure separate accommodation and exercise times for this stay.</p>
            </div>
          </div>
        )}

        {criticalHealthWarnings.length > 0 && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5">
            <p className="text-sm font-semibold text-rose-800 mb-1.5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Health records need attention — check in is still allowed
            </p>
            <ul className="space-y-0.5">
              {criticalHealthWarnings.map((w, i) => (
                <li key={i} className="text-sm text-rose-700">• {w}</li>
              ))}
            </ul>
          </div>
        )}

        {totalAdvisoryWarnings > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              {totalAdvisoryWarnings} detail{totalAdvisoryWarnings !== 1 ? 's' : ''} worth noting
            </p>
          </div>
        )}

        {/* Owner details */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Owner details</p>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-1">
            {ownerChecks.map(c => <CheckItem key={c.label} {...c} />)}
          </div>
        </div>

        {/* Per-pet sections */}
        {booking.booking_pets.map(bp => {
          const pet = bp.pet
          if (!pet) return null
          const hasVet    = !!(pet.vet_practice_name || pet.vet_phone)
          const hasVax    = pet.vaccinations.some(v => v.is_verified)
          const fleaDays  = pet.flea_treatment_date ? daysSince(pet.flea_treatment_date) : null
          const wormDays  = pet.worming_treatment_date ? daysSince(pet.worming_treatment_date) : null
          const fleaOk    = fleaDays !== null && fleaDays <= 30
          const wormOk    = wormDays !== null && wormDays <= 90
          const fleaAgo   = fleaDays === 0 ? 'today' : `${fleaDays}d ago`
          const wormAgo   = wormDays === 0 ? 'today' : `${wormDays}d ago`
          const fleaLabel = !pet.flea_treatment_date
            ? 'Flea treatment — no record'
            : fleaOk
              ? `Flea up to date${pet.flea_treatment_product ? ` — ${pet.flea_treatment_product}` : ''} (${fleaAgo})`
              : `Flea treatment overdue${pet.flea_treatment_product ? ` — ${pet.flea_treatment_product}` : ''} (${fleaAgo})`
          const wormLabel = !pet.worming_treatment_date
            ? 'Worming — no record'
            : wormOk
              ? `Worming up to date${pet.worming_treatment_product ? ` — ${pet.worming_treatment_product}` : ''} (${wormAgo})`
              : `Worming overdue${pet.worming_treatment_product ? ` — ${pet.worming_treatment_product}` : ''} (${wormAgo})`
          const advisoryChecks = [
            { label: hasVet ? `Vet — ${pet.vet_practice_name ?? pet.vet_phone}` : 'Vet details not recorded', ok: hasVet, href: `/pets/${pet.id}` },
            { label: pet.microchip_number ? `Microchipped — ${pet.microchip_number}` : 'Microchip not recorded', ok: !!pet.microchip_number, href: `/pets/${pet.id}` },
            { label: hasVax ? 'Vaccinations verified' : 'Vaccinations not verified', ok: hasVax, href: `/pets/${pet.id}` },
            { label: fleaLabel, ok: fleaOk, href: `/pets/${pet.id}` },
            { label: wormLabel, ok: wormOk, href: `/pets/${pet.id}` },
          ]
          const notes = petNotes[bp.id] ?? { feeding: '', medication: '', feedsPerDay: 2 }
          return (
            <div key={bp.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm select-none flex-shrink-0"
                  style={{ backgroundColor: pet.species?.colour ? `${pet.species.colour}20` : '#f1f5f9' }}
                >
                  {pet.species?.icon ?? '🐾'}
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{pet.name}</p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-1 mb-3">
                {advisoryChecks.map(c => <CheckItem key={c.label} {...c} />)}
              </div>

              {pet.behaviour_notes && (
                <div className="mb-3 rounded-lg bg-sky-50 border border-sky-100 px-3 py-2">
                  <p className="text-xs font-semibold text-sky-600 mb-0.5">Behaviour notes</p>
                  <p className="text-sm text-sky-900 whitespace-pre-wrap">{pet.behaviour_notes}</p>
                </div>
              )}

              <div className="mb-3">
                <label className="text-xs font-medium text-slate-600 block mb-1.5">
                  Feeds per day <span className="font-normal text-slate-400">(this stay)</span>
                </label>
                <div className="flex gap-2">
                  {([1, 2, 3, 4] as const).map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPetField(bp.id, 'feedsPerDay', n)}
                      className={[
                        'flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                        notes.feedsPerDay === n
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-400',
                      ].join(' ')}
                    >
                      {n}×
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Feeding instructions <span className="font-normal text-slate-400">(this stay)</span>
                  </label>
                  <textarea
                    value={notes.feeding}
                    onChange={e => setPetField(bp.id, 'feeding', e.target.value)}
                    rows={3}
                    placeholder={pet.feeding_instructions ?? 'None recorded on pet profile'}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Medication notes <span className="font-normal text-slate-400">(this stay)</span>
                  </label>
                  <textarea
                    value={notes.medication}
                    onChange={e => setPetField(bp.id, 'medication', e.target.value)}
                    rows={3}
                    placeholder={pet.medical_notes ?? 'None recorded on pet profile'}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-300"
                  />
                </div>
              </div>
            </div>
          )
        })}

        {/* Handover checklist */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Handover checklist</p>
          <div className="space-y-2">
            {handoverItems.map(item => (
              <label key={item.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!handover[item.key]}
                  onChange={e => setHandover(prev => ({ ...prev, [item.key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 accent-emerald-600 flex-shrink-0"
                />
                <span className={`text-sm ${handover[item.key] ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── CheckOutModal ─────────────────────────────────────────────────────────────

function CheckOutModal({ open, booking, requireBalance, currency, onClose, onConfirm }: {
  open:           boolean
  booking:        BookingDetail
  requireBalance: boolean
  currency:       string
  onClose:        () => void
  onConfirm:      () => Promise<void>
}) {
  const [handover, setHandover] = useState<Record<string, boolean>>({})
  const [saving,   setSaving]   = useState(false)
  const [outstanding, setOutstanding] = useState<number | null>(null)

  useEffect(() => { if (open) { setHandover({}); setSaving(false) } }, [open])

  useEffect(() => {
    if (open && requireBalance) {
      loadOutstanding(booking.id).then(r => setOutstanding(r.outstanding))
    } else {
      setOutstanding(null)
    }
  }, [open, requireBalance, booking.id])

  const today = new Date().toISOString().split('T')[0]
  const dateWarning = today < booking.end_date
    ? `Checking out early — booking ends ${formatBookingDate(booking.end_date)}`
    : today > booking.end_date
    ? `Overdue check-out — booking ended ${formatBookingDate(booking.end_date)}`
    : null

  const handoverItems = [
    { key: 'condition',  label: 'Pet condition checked — owner happy' },
    { key: 'belongings', label: 'Owner collected all belongings' },
    { key: 'meds',       label: 'Medication / food returned to owner' },
    { key: 'balance',    label: 'Balance settled / payment confirmed' },
  ]

  async function handleConfirm() {
    setSaving(true)
    try { await onConfirm() } finally { setSaving(false) }
  }

  const owner    = booking.owner
  const ownerName = owner ? `${owner.first_name} ${owner.last_name}` : 'Unknown owner'
  const pets     = booking.booking_pets.map(bp => bp.pet).filter(Boolean)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Check out — ${ownerName}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} loading={saving} icon={<LogOut className="w-4 h-4" />}>
            Complete check-out
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {dateWarning && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium">{dateWarning}</p>
          </div>
        )}

        {requireBalance && outstanding != null && outstanding > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <p className="text-sm text-rose-800 font-medium">
              Outstanding balance of {fmtMoney(outstanding, currency)} — collect before handover.
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Pets leaving</p>
          <div className="flex flex-wrap gap-2">
            {pets.map(pet => pet && (
              <div
                key={pet.id}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border border-slate-200 bg-slate-50"
              >
                <span>{pet.species?.icon ?? '🐾'}</span>
                {pet.name}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Charges</p>
          <p className="text-xs text-slate-400 mb-2">Re-estimate from rates or add a final charge before completing check-out.</p>
          <BookingPricing
            bookingId={booking.id}
            startDate={booking.start_date}
            endDate={booking.end_date}
            onTotalChanged={() => loadOutstanding(booking.id).then(r => setOutstanding(r.outstanding))}
            pets={booking.booking_pets.map(bp => ({
              id:  bp.id,
              pet: bp.pet ? { id: bp.pet.id, name: bp.pet.name, size: bp.pet.size, species_id: bp.pet.species?.id ?? null } : null,
              booking_space_assignments: bp.booking_space_assignments,
            }))}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Handover</p>
          <div className="space-y-2">
            {handoverItems.map(item => (
              <label key={item.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!handover[item.key]}
                  onChange={e => setHandover(prev => ({ ...prev, [item.key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 accent-emerald-600 flex-shrink-0"
                />
                <span className={`text-sm ${handover[item.key] ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Source labels ─────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  phone:    'Phone',
  walk_in:  'Walk-in',
  email:    'Email',
  portal:   'Owner portal',
  manual:   'Manual entry',
}

type BookingTab = 'overview' | 'charges' | 'journal' | 'activity'

function BookingTabs({ tabs, active, onSelect }: {
  tabs: { id: BookingTab; label: string }[]
  active: BookingTab
  onSelect: (t: BookingTab) => void
}) {
  return (
    <div className="flex border-b border-slate-200 mb-4 mt-5 overflow-x-auto">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          className={[
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
            active === t.id
              ? 'border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
          ].join(' ')}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export default function BookingDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { business, settings, staffUser, isAdmin } = useBusinessContext()
  const { can } = usePlan()
  const canDestruct = isAdmin || canDestructiveAction(staffUser?.role ?? 'read_only')
  const [tab, setTab] = useState<BookingTab>('overview')

  const [booking,        setBooking]        = useState<BookingDetail | null>(null)
  const [spaces,         setSpaces]         = useState<SpaceWithSpecies[]>([])
  const [loading,        setLoading]        = useState(true)
  const [notFound,       setNotFound]       = useState(false)
  const [editOpen,       setEditOpen]       = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [actionLoading,  setActionLoading]  = useState<'check_in' | 'check_out' | 'cancel' | 'restore' | 'recheckin' | 'confirm' | 'waiting_list' | null>(null)
  const [confirmCancel,  setConfirmCancel]  = useState(false)
  const [checkInOpen,    setCheckInOpen]    = useState(false)
  const [checkOutOpen,   setCheckOutOpen]   = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    const [bookingRes, spacesRes] = await Promise.all([
      supabase
        .from('bookings')
        .select(`
          id, business_id, status, start_date, end_date, notes, source, created_at, checked_in_at, checked_out_at,
          owner:owner_id (
            id, first_name, last_name, phone, email,
            address_line1, city,
            emergency_contact_name, emergency_contact_phone
          ),
          booking_pets (
            id, feeding_instructions, medication_notes, notes, feeds_per_day,
            pet:pet_id (
              id, name, breed, size, can_mix_with_others, feeds_per_day,
              behaviour_notes, feeding_instructions, medical_notes,
              vet_practice_name, vet_phone, microchip_number,
              flea_treatment_date, flea_treatment_product,
              worming_treatment_date, worming_treatment_product,
              species:species_id ( id, name, icon, colour ),
              vaccinations ( id, is_verified )
            ),
            booking_space_assignments (
              id,
              space:space_id ( id, name, area_id )
            )
          )
        `)
        .eq('id', id)
        .single(),
      supabase
        .from('accommodation_spaces')
        .select(SPACES_QUERY)
        .eq('is_active', true)
        .order('sort_order'),
    ])

    if (bookingRes.error || !bookingRes.data) {
      setNotFound(true)
    } else {
      setBooking(bookingRes.data as unknown as BookingDetail)
    }
    setSpaces((spacesRes.data ?? []) as unknown as SpaceWithSpecies[])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // Auto-open modals when navigated here from the operations board
  useEffect(() => {
    if (!booking || loading) return
    const state = location.state as any
    if (state?.autoCheckin) {
      setCheckInOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    } else if (state?.autoCheckout) {
      setCheckOutOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, booking, loading])

  async function handleEdit(form: EditForm) {
    if (!booking) return

    // If dates changed and the booking has space assignments, check for conflicts
    const datesChanged = form.startDate !== booking.start_date || form.endDate !== booking.end_date
    if (datesChanged) {
      const ownAssignmentIds: string[] = []
      const spaceCountMap = new Map<string, number>()
      for (const bp of booking.booking_pets) {
        for (const sa of bp.booking_space_assignments) {
          if (!sa.space?.id) continue
          ownAssignmentIds.push(sa.id)
          spaceCountMap.set(sa.space.id, (spaceCountMap.get(sa.space.id) ?? 0) + 1)
        }
      }
      if (spaceCountMap.size > 0) {
        // Query active bookings (excluding this one) that overlap the new date range,
        // drilling down to their space assignments. Natural direction avoids join ambiguity.
        const { data: conflicting } = await supabase
          .from('bookings')
          .select('id, booking_pets(booking_space_assignments(space_id))')
          .in('status', ['confirmed', 'checked_in', 'due_out'])
          .neq('id', booking.id)
          .lte('start_date', form.endDate)
          .gte('end_date', form.startDate)
        const otherCounts = new Map<string, number>()
        for (const b of conflicting ?? []) {
          for (const bp of (b as any).booking_pets ?? []) {
            for (const sa of bp.booking_space_assignments ?? []) {
              if (spaceCountMap.has(sa.space_id)) {
                otherCounts.set(sa.space_id, (otherCounts.get(sa.space_id) ?? 0) + 1)
              }
            }
          }
        }
        for (const [spaceId, ownCount] of spaceCountMap) {
          const space = spaces.find(s => s.id === spaceId)
          if (!space) continue
          if ((otherCounts.get(spaceId) ?? 0) + ownCount > space.max_pets) {
            throw new Error(`"${space.name}" is fully booked for those dates. Choose different dates or reassign the space first.`)
          }
        }
      }
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        start_date: form.startDate,
        end_date:   form.endDate,
        notes:      form.notes.trim() || null,
      })
      .eq('id', booking.id)
    if (error) throw new Error(error.message)

    // Keep space assignment dates in sync with the booking dates
    const bookingPetIds = booking.booking_pets.map(bp => bp.id)
    if (bookingPetIds.length > 0) {
      const { error: saErr } = await supabase
        .from('booking_space_assignments')
        .update({ start_date: form.startDate, end_date: form.endDate })
        .in('booking_pet_id', bookingPetIds)
      if (saErr) throw new Error(saErr.message)
    }

    await logAudit(booking.business_id, {
      action:      'booking.updated',
      entity_type: 'booking',
      entity_id:   booking.id,
      before: { start_date: booking.start_date, end_date: booking.end_date, notes: booking.notes },
      after:  { start_date: form.startDate,      end_date: form.endDate,      notes: form.notes.trim() || null },
    })
    await load()
  }

  async function handleDelete() {
    if (!booking) return
    setDeleting(true)
    const { error } = await supabase.from('bookings').delete().eq('id', booking.id)
    if (error) {
      alert(error.message)
      setDeleting(false)
      setConfirmDelete(false)
      return
    }
    navigate('/bookings')
  }

  async function handleCheckIn() {
    setCheckInOpen(true)
  }

  async function handleCheckInConfirm(petNotes: Record<string, PetNoteState>) {
    if (!booking) return
    for (const [bpId, notes] of Object.entries(petNotes)) {
      await supabase
        .from('booking_pets')
        .update({
          feeding_instructions: notes.feeding.trim() || null,
          medication_notes:     notes.medication.trim() || null,
          feeds_per_day:        notes.feedsPerDay,
        })
        .eq('id', bpId)
    }
    const wasCheckedOut = booking.status === 'checked_out'
    const { error } = await supabase
      .from('bookings')
      .update({
        status:         'checked_in',
        checked_in_at:  new Date().toISOString(),
        ...(wasCheckedOut ? { checked_out_at: null } : {}),
      })
      .eq('id', booking.id)
    if (error) throw new Error(error.message)
    await logAudit(booking.business_id, {
      action:      'booking.checked_in',
      entity_type: 'booking',
      entity_id:   booking.id,
      before: { status: booking.status },
      after:  { status: 'checked_in' },
    })
    setCheckInOpen(false)
    await load()
  }

  async function handleCheckOut() {
    setCheckOutOpen(true)
  }

  async function handleCheckOutConfirm() {
    if (!booking) return
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'checked_out', checked_out_at: new Date().toISOString() })
      .eq('id', booking.id)
    if (error) throw new Error(error.message)
    await logAudit(booking.business_id, {
      action:      'booking.checked_out',
      entity_type: 'booking',
      entity_id:   booking.id,
      before: { status: booking.status },
      after:  { status: 'checked_out' },
    })
    setCheckOutOpen(false)
    await load()
  }

  async function handleConfirm() {
    if (!booking) return
    if (missingItems.critical.length > 0) return  // blocked — CriticalPanel explains why
    setActionLoading('confirm')
    const prevStatus = booking.status
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking.id)
    setActionLoading(null)
    if (error) { alert(error.message); return }
    await logAudit(booking.business_id, {
      action:      'booking.status_changed',
      entity_type: 'booking',
      entity_id:   booking.id,
      before: { status: prevStatus },
      after:  { status: 'confirmed' },
    })
    await load()
  }

  async function handleToWaitingList() {
    if (!booking) return
    setActionLoading('waiting_list')
    const prevStatus = booking.status
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'waiting_list' })
      .eq('id', booking.id)
    setActionLoading(null)
    if (error) { alert(error.message); return }
    await logAudit(booking.business_id, {
      action:      'booking.status_changed',
      entity_type: 'booking',
      entity_id:   booking.id,
      before: { status: prevStatus },
      after:  { status: 'waiting_list' },
    })
    await load()
  }

  async function handleCancel() {
    if (!booking) return
    setActionLoading('cancel')
    const prevStatus = booking.status
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id)
    setActionLoading(null)
    setConfirmCancel(false)
    if (error) { alert(error.message); return }
    await logAudit(booking.business_id, {
      action:      'booking.status_changed',
      entity_type: 'booking',
      entity_id:   booking.id,
      before: { status: prevStatus },
      after:  { status: 'cancelled' },
    })
    await load()
  }

  async function handleRecheckIn() {
    setCheckInOpen(true)
  }

  async function handleRestore() {
    if (!booking) return
    setActionLoading('restore')
    const prevStatus = booking.status
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'enquiry' })
      .eq('id', booking.id)
    setActionLoading(null)
    if (error) { alert(error.message); return }
    await logAudit(booking.business_id, {
      action:      'booking.status_changed',
      entity_type: 'booking',
      entity_id:   booking.id,
      before: { status: prevStatus },
      after:  { status: 'enquiry' },
    })
    await load()
  }

  const missingItems = useMemo(
    () => booking ? computeMissing(booking) : { critical: [], advisory: [] },
    [booking],
  )

  if (loading) {
    return <div className="max-w-2xl px-5 py-8 text-sm text-slate-400 text-center">Loading…</div>
  }

  if (notFound || !booking) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Booking not found" backHref="/bookings" />
        <p className="text-sm text-slate-500">This booking could not be found.</p>
      </div>
    )
  }

  const ref           = `#${booking.id.slice(0, 8).toUpperCase()}`
  const owner         = booking.owner
  const nights        = nightsBetween(booking.start_date, booking.end_date)
  const displayStatus = computeDisplayStatus(
    booking.status,
    missingItems.critical.length + missingItems.advisory.length > 0,
  )

  const journalAvailable = can('stayJournal') && settings?.stay_journal_enabled !== false
  const tabs: { id: BookingTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'charges',  label: 'Charges & payments' },
    ...(journalAvailable ? [{ id: 'journal' as BookingTab, label: 'Journal' }] : []),
    { id: 'activity', label: 'Activity' },
  ]
  const activeTab: BookingTab = tabs.some(t => t.id === tab) ? tab : 'overview'

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`Booking ${ref}`}
        backHref="/bookings"
        action={
          confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Delete this booking?</span>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>Yes, delete</Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Pencil className="w-3.5 h-3.5" />}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
              {canDestruct && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => setConfirmDelete(true)}
                  className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                  Delete
                </Button>
              )}
            </div>
          )
        }
      />

      {/* Health compliance blocks (vaccinations, flea, worm) */}
      <CriticalPanel items={missingItems.critical} />
      {/* Advisory notes (emergency contact, vet, microchip) */}
      <AdvisoryPanel items={missingItems.advisory} />

      {/* Status action bar */}
      <StatusActionBar
        booking={booking}
        actionLoading={actionLoading}
        confirmCancel={confirmCancel}
        confirmBlocked={missingItems.critical.length > 0}
        canCancel={canDestruct}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        onConfirm={handleConfirm}
        onToWaitingList={handleToWaitingList}
        onCancelRequest={() => setConfirmCancel(true)}
        onCancelConfirm={handleCancel}
        onCancelAbort={() => setConfirmCancel(false)}
        onRestore={handleRestore}
        onRecheckIn={handleRecheckIn}
      />

      <BookingTabs tabs={tabs} active={activeTab} onSelect={setTab} />

      {activeTab === 'overview' && (<>
      {/* Booking summary */}
      <Card>
        <dl>
          <SectionHeader title="Booking details" />

          <div className="flex gap-4 py-1.5">
            <dt className="text-sm text-slate-500 w-36 flex-shrink-0">Status</dt>
            <dd><StatusBadge status={dbStatusToUi(displayStatus)} size="md" /></dd>
          </div>

          <div className="flex gap-4 py-1.5">
            <dt className="text-sm text-slate-500 w-36 flex-shrink-0">Arrival</dt>
            <dd className="text-sm text-slate-900">{formatBookingDate(booking.start_date)}</dd>
          </div>
          <div className="flex gap-4 py-1.5">
            <dt className="text-sm text-slate-500 w-36 flex-shrink-0">Departure</dt>
            <dd className="text-sm text-slate-900">
              {formatBookingDate(booking.end_date)}
              <span className="text-slate-400 ml-2">
                ({nights} night{nights !== 1 ? 's' : ''})
              </span>
            </dd>
          </div>

          <InfoRow label="Source"  value={SOURCE_LABELS[booking.source] ?? booking.source} />

          {booking.notes && (
            <>
              <hr className="border-slate-100 my-4" />
              <SectionHeader title="Notes" />
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{booking.notes}</p>
            </>
          )}
        </dl>
      </Card>

      {/* Owner */}
      {owner && (
        <div className="mt-4">
          <Card>
            <dl>
              <SectionHeader title="Owner" />
              <div className="flex gap-4 py-1.5">
                <dt className="text-sm text-slate-500 w-36 flex-shrink-0">Name</dt>
                <dd className="text-sm">
                  <Link
                    to={`/owners/${owner.id}`}
                    className="hover:underline"
                    style={{ color: 'var(--brand-primary)' }}
                  >
                    {owner.first_name} {owner.last_name}
                  </Link>
                </dd>
              </div>
              <InfoRow label="Phone" value={owner.phone} />
              {owner.email ? (
                <InfoRow label="Email" value={owner.email} />
              ) : (
                <div className="flex gap-4 py-1.5">
                  <dt className="text-sm text-slate-500 w-36 flex-shrink-0">Email</dt>
                  <dd className="text-sm text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    Not on file
                  </dd>
                </div>
              )}
              {owner.emergency_contact_name ? (
                <InfoRow label="Emergency contact" value={owner.emergency_contact_name} />
              ) : (
                <div className="flex gap-4 py-1.5">
                  <dt className="text-sm text-slate-500 w-36 flex-shrink-0">Emergency contact</dt>
                  <dd className="text-sm text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    Not on file
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      )}

      {/* Pets */}
      {booking.booking_pets.length > 0 && (
        <div className="mt-4">
          <Card>
            <SectionHeader title={`Pets (${booking.booking_pets.length})`} />
            <div className="divide-y divide-slate-100 -mx-5">
              {booking.booking_pets.map(bp => {
                const pet = bp.pet
                if (!pet) return null
                return (
                  <div key={bp.id} className="flex items-start gap-3 px-5 py-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 select-none mt-0.5"
                      style={{ backgroundColor: pet.species?.colour ? `${pet.species.colour}20` : '#f1f5f9' }}
                    >
                      {pet.species?.icon ?? '🐾'}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Name + species */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/pets/${pet.id}`}
                          className="text-sm font-medium hover:underline"
                          style={{ color: 'var(--brand-primary)' }}
                        >
                          {pet.name}
                        </Link>
                        {pet.species && (
                          <span className="text-xs text-slate-400">{pet.species.name}</span>
                        )}
                        {pet.breed && (
                          <span className="text-xs text-slate-500">· {pet.breed}</span>
                        )}
                      </div>

                      {/* Space assignment — editable inline */}
                      {spaces.length > 0 ? (
                        <PetSpaceSelect
                          bp={bp}
                          spaces={spaces}
                          booking={booking}
                          onChanged={load}
                        />
                      ) : (
                        bp.booking_space_assignments[0]?.space ? (
                          <p className="text-xs text-slate-500">
                            {bp.booking_space_assignments[0].space.name}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No space assigned</p>
                        )
                      )}
                    </div>

                    {/* Health/records status icons */}
                    <div className="flex-shrink-0 flex flex-col gap-1 items-end pt-0.5">
                      {!pet.can_mix_with_others && (
                        <span className="flex items-center gap-1 text-xs font-medium text-rose-600">
                          <Ban className="w-3.5 h-3.5" />
                          No mixing
                        </span>
                      )}
                      {pet.vet_practice_name || pet.vet_phone ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Vet on file
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle className="w-3.5 h-3.5" />
                          No vet details
                        </span>
                      )}
                      {pet.microchip_number ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Microchipped
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle className="w-3.5 h-3.5" />
                          No microchip
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
      </>)}

      {activeTab === 'charges' && (<>
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" icon={<Printer className="w-3.5 h-3.5" />}
          onClick={() => printBookingReceipt(booking.id, business?.name ?? 'Receipt', settings?.currency ?? 'GBP')}>
          Print receipt
        </Button>
      </div>
      {/* Pricing */}
      <div className="mt-4">
        <Card>
          <SectionHeader title="Charges" />
          <BookingPricing
            bookingId={booking.id}
            startDate={booking.start_date}
            endDate={booking.end_date}
            pets={booking.booking_pets.map(bp => ({
              id:  bp.id,
              pet: bp.pet ? {
                id:         bp.pet.id,
                name:       bp.pet.name,
                size:       bp.pet.size,
                species_id: bp.pet.species?.id ?? null,
              } : null,
              booking_space_assignments: bp.booking_space_assignments,
            }))}
          />
        </Card>
      </div>

      {/* Payments */}
      <BookingPayments bookingId={booking.id} />
      </>)}

      {activeTab === 'journal' && <StayJournal bookingId={booking.id} />}

      {activeTab === 'activity' && <AuditLog entityId={booking.id} />}

      <EditBookingModal
        open={editOpen}
        booking={booking}
        onClose={() => setEditOpen(false)}
        onSave={handleEdit}
      />

      {checkInOpen && (
        <CheckInModal
          open={checkInOpen}
          booking={booking}
          onClose={() => setCheckInOpen(false)}
          onConfirm={handleCheckInConfirm}
        />
      )}

      {checkOutOpen && (
        <CheckOutModal
          open={checkOutOpen}
          booking={booking}
          requireBalance={!!settings?.require_balance_before_checkout}
          currency={settings?.currency ?? 'GBP'}
          onClose={() => setCheckOutOpen(false)}
          onConfirm={handleCheckOutConfirm}
        />
      )}
    </div>
  )
}
