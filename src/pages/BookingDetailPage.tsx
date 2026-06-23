import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Pencil, Trash2, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, Button, Modal, Input, Select, Textarea, StatusBadge } from '@/components/ui'
import {
  type DbBookingStatus, type SpaceWithSpecies,
  SELECTABLE_STATUSES, dbStatusToUi, formatBookingDate, SPACES_QUERY,
} from '@/pages/BookingsPage'

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
    pet: {
      id: string
      name: string
      breed: string | null
      vet_practice_name: string | null
      vet_phone: string | null
      microchip_number: string | null
      species: { id: string; name: string; icon: string | null; colour: string | null } | null
    } | null
    booking_space_assignments: {
      id: string
      space: { id: string; name: string } | null
    }[]
  }[]
}

type MissingItem = { label: string; href: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nightsBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000
  )
}

function computeMissing(booking: BookingDetail): MissingItem[] {
  const items: MissingItem[] = []
  const owner = booking.owner
  if (owner) {
    if (!owner.email)
      items.push({ label: `Email address missing for ${owner.first_name}`, href: `/owners/${owner.id}` })
    if (!owner.address_line1 && !owner.city)
      items.push({ label: `Address missing for ${owner.first_name}`, href: `/owners/${owner.id}` })
    if (!owner.emergency_contact_name || !owner.emergency_contact_phone)
      items.push({ label: `Emergency contact details missing for ${owner.first_name}`, href: `/owners/${owner.id}` })
  }
  for (const bp of booking.booking_pets) {
    const pet = bp.pet
    if (!pet) continue
    if (!pet.vet_practice_name && !pet.vet_phone)
      items.push({ label: `Vet details missing for ${pet.name}`, href: `/pets/${pet.id}` })
    if (!pet.microchip_number)
      items.push({ label: `Microchip number missing for ${pet.name}`, href: `/pets/${pet.id}` })
  }
  return items
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

function AttentionPanel({ items }: { items: MissingItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-800">
          {items.length} item{items.length !== 1 ? 's' : ''} still needed before check-in
        </p>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
            <Link
              to={item.href}
              className="text-sm text-amber-800 hover:text-amber-900 hover:underline"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Edit booking modal ───────────────────────────────────────────────────────

interface EditForm {
  status:    DbBookingStatus
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
    status:    booking.status,
    startDate: booking.start_date,
    endDate:   booking.end_date,
    notes:     booking.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm({ status: booking.status, startDate: booking.start_date, endDate: booking.end_date, notes: booking.notes ?? '' })
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

        <Select
          id="eb-status"
          label="Status"
          value={form.status}
          onChange={e => setField('status', e.target.value as DbBookingStatus)}
        >
          {SELECTABLE_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>

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
  const [saving,     setSaving]     = useState(false)
  const [spaceError, setSpaceError] = useState<string | null>(null)

  const currentAssignment = bp.booking_space_assignments[0] ?? null
  const currentSpaceId    = currentAssignment?.space?.id ?? ''
  const petSpeciesId      = bp.pet?.species?.id ?? ''
  const petSpeciesName    = bp.pet?.species?.name ?? ''

  // Filter to species-compatible spaces only (show all if species unknown)
  const compatibleSpaces = spaces.filter(s =>
    !petSpeciesId ||
    s.accommodation_space_species.some(ss => ss.species_id === petSpeciesId)
  )
  const incompatibleSpaces = spaces.filter(s =>
    petSpeciesId &&
    !s.accommodation_space_species.some(ss => ss.species_id === petSpeciesId)
  )

  // Group by area
  const spacesByArea = useMemo(() => {
    const groups = new Map<string, { areaName: string; spaces: SpaceWithSpecies[] }>()
    for (const s of compatibleSpaces) {
      const areaId   = s.area?.id   ?? '__none'
      const areaName = s.area?.name ?? 'Ungrouped'
      if (!groups.has(areaId)) groups.set(areaId, { areaName, spaces: [] })
      groups.get(areaId)!.spaces.push(s)
    }
    return [...groups.values()]
  }, [compatibleSpaces])

  async function handleChange(newSpaceId: string) {
    // Validate species compatibility
    if (newSpaceId && petSpeciesId) {
      const space = spaces.find(s => s.id === newSpaceId)
      if (space) {
        const ok = space.accommodation_space_species.some(ss => ss.species_id === petSpeciesId)
        if (!ok) {
          setSpaceError(`${space.name} does not accept ${petSpeciesName}. Choose a compatible space.`)
          return
        }
      }
    }
    setSaving(true)
    setSpaceError(null)
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

const SOURCE_LABELS: Record<string, string> = {
  phone:    'Phone',
  walk_in:  'Walk-in',
  email:    'Email',
  portal:   'Owner portal',
  manual:   'Manual entry',
}

export default function BookingDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [booking,       setBooking]       = useState<BookingDetail | null>(null)
  const [spaces,        setSpaces]        = useState<SpaceWithSpecies[]>([])
  const [loading,       setLoading]       = useState(true)
  const [notFound,      setNotFound]      = useState(false)
  const [editOpen,      setEditOpen]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    const [bookingRes, spacesRes] = await Promise.all([
      supabase
        .from('bookings')
        .select(`
          id, business_id, status, start_date, end_date, notes, source, created_at,
          owner:owner_id (
            id, first_name, last_name, phone, email,
            address_line1, city,
            emergency_contact_name, emergency_contact_phone
          ),
          booking_pets (
            id,
            pet:pet_id (
              id, name, breed,
              vet_practice_name, vet_phone, microchip_number,
              species:species_id ( id, name, icon, colour )
            ),
            booking_space_assignments (
              id,
              space:space_id ( id, name )
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

  async function handleEdit(form: EditForm) {
    if (!booking) return
    const { error } = await supabase
      .from('bookings')
      .update({
        status:     form.status,
        start_date: form.startDate,
        end_date:   form.endDate,
        notes:      form.notes.trim() || null,
      })
      .eq('id', booking.id)
    if (error) throw new Error(error.message)
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

  const missingItems = useMemo(() => booking ? computeMissing(booking) : [], [booking])

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

  const ref     = `#${booking.id.slice(0, 8).toUpperCase()}`
  const owner   = booking.owner
  const nights  = nightsBetween(booking.start_date, booking.end_date)

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
              <Button
                variant="secondary"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => setConfirmDelete(true)}
                className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                Delete
              </Button>
            </div>
          )
        }
      />

      {/* Missing info attention panel */}
      <AttentionPanel items={missingItems} />

      {/* Booking summary */}
      <Card>
        <dl>
          <SectionHeader title="Booking details" />

          <div className="flex gap-4 py-1.5">
            <dt className="text-sm text-slate-500 w-36 flex-shrink-0">Status</dt>
            <dd><StatusBadge status={dbStatusToUi(booking.status)} size="md" /></dd>
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

      <EditBookingModal
        open={editOpen}
        booking={booking}
        onClose={() => setEditOpen(false)}
        onSave={handleEdit}
      />
    </div>
  )
}
