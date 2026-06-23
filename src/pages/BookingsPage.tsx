import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, CalendarDays, X, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import {
  PageHeader, Card, Button, Modal, Input, Select, Textarea, EmptyState,
  StatusBadge, type BookingStatus,
} from '@/components/ui'
import type { Database } from '@/types/database'

// ─── Types & constants ────────────────────────────────────────────────────────

export type DbBookingStatus = Database['public']['Enums']['booking_status']
type Owner   = Database['public']['Tables']['owners']['Row']
type Species = Database['public']['Tables']['species']['Row']

export const STATUS_LABELS: Record<DbBookingStatus, string> = {
  enquiry:             'Enquiry',
  provisional:         'Provisional',
  confirmed:           'Confirmed',
  details_outstanding: 'Details outstanding',
  ready:               'Ready for arrival',
  checked_in:          'Checked in',
  due_out:             'Due out today',
  checked_out:         'Checked out',
  cancelled:           'Cancelled',
  waiting_list:        'Waiting list',
}

export const SELECTABLE_STATUSES: { value: DbBookingStatus; label: string }[] = [
  { value: 'enquiry',             label: 'Enquiry'             },
  { value: 'provisional',         label: 'Provisional'         },
  { value: 'confirmed',           label: 'Confirmed'           },
  { value: 'details_outstanding', label: 'Details outstanding' },
  { value: 'ready',               label: 'Ready for arrival'   },
  { value: 'checked_in',          label: 'Checked in'          },
  { value: 'checked_out',         label: 'Checked out'         },
  { value: 'cancelled',           label: 'Cancelled'           },
  { value: 'waiting_list',        label: 'Waiting list'        },
]

export function dbStatusToUi(s: DbBookingStatus): BookingStatus {
  return s.replace(/_/g, '-') as BookingStatus
}

export function formatBookingDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function nightsBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000
  )
}

// ─── Space type (exported for BookingDetailPage) ──────────────────────────────

export type SpaceWithSpecies = {
  id: string
  name: string
  max_pets: number
  same_household_only: boolean
  allow_mixed_species: boolean
  area: { id: string; name: string } | null
  accommodation_space_species: { species_id: string }[]
}

export const SPACES_QUERY =
  'id, name, max_pets, same_household_only, allow_mixed_species, ' +
  'area:area_id(id, name), accommodation_space_species(species_id)'

// ─── NewBookingModal types ────────────────────────────────────────────────────

type OwnerOption = Pick<Owner, 'id' | 'first_name' | 'last_name'>
type OwnerPetOpt = { id: string; name: string; species: Pick<Species, 'id' | 'name' | 'icon'> | null }

interface NewPetEntry { _key: string; name: string; speciesId: string }

interface BookingForm {
  ownerId: string
  startDate: string
  endDate: string
  status: DbBookingStatus
  notes: string
  spaceAssignments: Record<string, string>  // petKey → spaceId ('' = unassigned)
  selectedPetIds: Set<string>
  newPets: NewPetEntry[]
}

const EMPTY_FORM: BookingForm = {
  ownerId: '', startDate: '', endDate: '', status: 'enquiry',
  notes: '', spaceAssignments: {}, selectedPetIds: new Set(), newPets: [],
}

// ─── Space validation ─────────────────────────────────────────────────────────

type PetForAssignment = { key: string; name: string; speciesId: string; speciesName: string }
type SpaceIssue = { message: string; blocking: boolean }

function validateSpaces(
  assignments: Record<string, string>,
  pets: PetForAssignment[],
  spaces: SpaceWithSpecies[],
): SpaceIssue[] {
  const issues: SpaceIssue[] = []

  // Group pets by the space they've been assigned to
  const bySpace = new Map<string, PetForAssignment[]>()
  for (const pet of pets) {
    const spaceId = assignments[pet.key]
    if (!spaceId) continue
    if (!bySpace.has(spaceId)) bySpace.set(spaceId, [])
    bySpace.get(spaceId)!.push(pet)
  }

  for (const [spaceId, assigned] of bySpace) {
    const space = spaces.find(s => s.id === spaceId)
    if (!space) continue

    // Species incompatibility — hard block
    for (const pet of assigned) {
      if (!pet.speciesId) continue
      const ok = space.accommodation_space_species.some(ss => ss.species_id === pet.speciesId)
      if (!ok) {
        issues.push({
          message: `${space.name} does not accept ${pet.speciesName || 'this species'} — ${pet.name} cannot be placed there.`,
          blocking: true,
        })
      }
    }

    // Mixed species — hard block if space disallows it
    if (!space.allow_mixed_species && assigned.length > 1) {
      const uniqueSpecies = new Set(assigned.map(p => p.speciesId).filter(Boolean))
      if (uniqueSpecies.size > 1) {
        const names = assigned.map(p => p.name).join(' and ')
        issues.push({
          message: `${space.name} does not allow mixed species — assign ${names} to separate spaces.`,
          blocking: true,
        })
      }
    }

    // Over capacity — hard block (staff can leave unassigned and fix later)
    if (assigned.length > space.max_pets) {
      issues.push({
        message: `${space.name} holds a maximum of ${space.max_pets} pet${space.max_pets !== 1 ? 's' : ''} — you've assigned ${assigned.length}.`,
        blocking: true,
      })
    }
  }

  return issues
}

// ─── NewBookingModal ──────────────────────────────────────────────────────────

export interface NewBookingModalProps {
  open: boolean
  onClose: () => void
  onCreated: (bookingId: string) => void
}

export function NewBookingModal({ open, onClose, onCreated }: NewBookingModalProps) {
  const { business } = useBusinessContext()

  const [form,        setForm]        = useState<BookingForm>(EMPTY_FORM)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [owners,      setOwners]      = useState<OwnerOption[]>([])
  const [ownerPets,   setOwnerPets]   = useState<OwnerPetOpt[]>([])
  const [allSpecies,  setAllSpecies]  = useState<Species[]>([])
  const [spaces,      setSpaces]      = useState<SpaceWithSpecies[]>([])
  const [saving,      setSaving]      = useState(false)
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [petsLoading, setPetsLoading] = useState(false)

  // Load reference data when modal opens
  useEffect(() => {
    if (!open) return
    setForm(EMPTY_FORM)
    setOwnerSearch('')
    setOwnerPets([])
    setErrors({})
    Promise.all([
      supabase.from('owners').select('id, first_name, last_name').eq('is_active', true).order('last_name').order('first_name'),
      supabase.from('species').select('*').order('is_system_default', { ascending: false }).order('sort_order').order('name'),
      supabase.from('accommodation_spaces').select(SPACES_QUERY).eq('is_active', true).order('sort_order'),
    ]).then(([ownersRes, speciesRes, spacesRes]) => {
      setOwners(ownersRes.data ?? [])
      setAllSpecies(speciesRes.data ?? [])
      setSpaces((spacesRes.data ?? []) as unknown as SpaceWithSpecies[])
    })
  }, [open])

  // Load owner's pets when ownerId changes
  useEffect(() => {
    if (!form.ownerId) { setOwnerPets([]); return }
    setPetsLoading(true)
    supabase
      .from('pets')
      .select('id, name, species:species_id(id, name, icon)')
      .eq('owner_id', form.ownerId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setOwnerPets((data ?? []) as OwnerPetOpt[])
        setPetsLoading(false)
      })
  }, [form.ownerId])

  // Combined list of all pets included in the booking (for space assignment)
  const petsForAssignment = useMemo<PetForAssignment[]>(() => {
    const list: PetForAssignment[] = []
    for (const petId of form.selectedPetIds) {
      const pet = ownerPets.find(p => p.id === petId)
      if (pet) list.push({
        key: petId,
        name: pet.name,
        speciesId: pet.species?.id ?? '',
        speciesName: pet.species?.name ?? '',
      })
    }
    for (const np of form.newPets) {
      const sp = allSpecies.find(s => s.id === np.speciesId)
      list.push({
        key: np._key,
        name: np.name.trim() || 'New pet',
        speciesId: np.speciesId,
        speciesName: sp?.name ?? '',
      })
    }
    return list
  }, [form.selectedPetIds, form.newPets, ownerPets, allSpecies])

  const spaceIssues = useMemo(
    () => validateSpaces(form.spaceAssignments, petsForAssignment, spaces),
    [form.spaceAssignments, petsForAssignment, spaces]
  )

  const filteredOwners = useMemo(
    () => ownerSearch
      ? owners.filter(o =>
          `${o.first_name} ${o.last_name}`.toLowerCase().includes(ownerSearch.toLowerCase())
        ).slice(0, 10)
      : [],
    [owners, ownerSearch]
  )

  const spacesByArea = useMemo(() => {
    const groups = new Map<string, { areaName: string; spaces: SpaceWithSpecies[] }>()
    for (const s of spaces) {
      const areaId   = s.area?.id   ?? '__none'
      const areaName = s.area?.name ?? 'Ungrouped'
      if (!groups.has(areaId)) groups.set(areaId, { areaName, spaces: [] })
      groups.get(areaId)!.spaces.push(s)
    }
    return [...groups.values()]
  }, [spaces])

  const selectedOwner = form.ownerId ? owners.find(o => o.id === form.ownerId) : null

  function clearError(k: string) {
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  function setField<K extends keyof BookingForm>(k: K, v: BookingForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
    clearError(k as string)
  }

  function selectOwner(o: OwnerOption) {
    setForm(f => ({ ...f, ownerId: o.id, selectedPetIds: new Set(), newPets: [], spaceAssignments: {} }))
    setOwnerSearch('')
    clearError('ownerId')
  }

  function togglePet(petId: string) {
    setForm(f => {
      const next = new Set(f.selectedPetIds)
      if (next.has(petId)) {
        next.delete(petId)
        const sa = { ...f.spaceAssignments }
        delete sa[petId]
        return { ...f, selectedPetIds: next, spaceAssignments: sa }
      }
      next.add(petId)
      return { ...f, selectedPetIds: next }
    })
    clearError('pets')
  }

  function addNewPet() {
    setForm(f => ({
      ...f,
      newPets: [...f.newPets, { _key: crypto.randomUUID(), name: '', speciesId: '' }],
    }))
  }

  function updateNewPet(key: string, field: 'name' | 'speciesId', value: string) {
    setForm(f => ({
      ...f,
      newPets: f.newPets.map(p => p._key === key ? { ...p, [field]: value } : p),
    }))
  }

  function removeNewPet(key: string) {
    setForm(f => {
      const sa = { ...f.spaceAssignments }
      delete sa[key]
      return { ...f, newPets: f.newPets.filter(p => p._key !== key), spaceAssignments: sa }
    })
  }

  function setSpaceForPet(petKey: string, spaceId: string) {
    setForm(f => ({ ...f, spaceAssignments: { ...f.spaceAssignments, [petKey]: spaceId } }))
  }

  async function handleSave() {
    if (!business) return
    const errs: Record<string, string> = {}
    if (!form.ownerId)   errs.ownerId = 'Select an owner'
    if (!form.startDate) errs.startDate = 'Arrival date is required'
    if (!form.endDate)   errs.endDate = 'Departure date is required'
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      errs.endDate = 'Departure must be on or after arrival'
    if (form.selectedPetIds.size === 0 && form.newPets.length === 0)
      errs.pets = 'Add at least one pet to this booking'
    form.newPets.forEach((np, i) => {
      if (!np.name.trim())  errs[`np_${i}_name`]    = 'Name required'
      if (!np.speciesId)    errs[`np_${i}_species`] = 'Species required'
    })

    // Block on space validation errors
    if (spaceIssues.some(i => i.blocking)) {
      errs.spaceIssues = 'Fix space assignment errors before saving.'
    }

    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    try {
      // 1. Create minimal pet records for new pets; track _key → new pet_id
      const keyToNewPetId = new Map<string, string>()
      for (const np of form.newPets) {
        const { data, error } = await supabase
          .from('pets')
          .insert({
            business_id: business.id,
            owner_id:    form.ownerId,
            species_id:  np.speciesId,
            name:        np.name.trim(),
            sex:         'unknown',
            is_active:   true,
          })
          .select('id')
          .single()
        if (error) throw new Error(error.message)
        keyToNewPetId.set(np._key, data.id)
      }

      // 2. Create the booking
      const { data: booking, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          business_id: business.id,
          owner_id:    form.ownerId,
          status:      form.status,
          start_date:  form.startDate,
          end_date:    form.endDate,
          source:      'phone',
          notes:       form.notes.trim() || null,
        })
        .select('id')
        .single()
      if (bookingErr) throw new Error(bookingErr.message)

      // 3. Create booking_pets; keep pet_id so we can look up space assignments
      const allPetIds = [
        ...[...form.selectedPetIds],
        ...[...keyToNewPetId.values()],
      ]
      const { data: bpRows, error: bpErr } = await supabase
        .from('booking_pets')
        .insert(allPetIds.map(petId => ({
          booking_id:  booking.id,
          pet_id:      petId,
          business_id: business.id,
        })))
        .select('id, pet_id')
      if (bpErr) throw new Error(bpErr.message)

      // 4. Create per-pet space assignments
      //    Map pet_id → form key so we can look up spaceAssignments
      const petIdToKey = new Map<string, string>()
      for (const petId of form.selectedPetIds) petIdToKey.set(petId, petId)
      for (const [key, petId] of keyToNewPetId) petIdToKey.set(petId, key)

      const spaceInserts = (bpRows ?? [])
        .map(bp => {
          const key     = petIdToKey.get(bp.pet_id)
          const spaceId = key ? form.spaceAssignments[key] : undefined
          if (!spaceId) return null
          return {
            booking_pet_id: bp.id,
            space_id:       spaceId,
            business_id:    business.id,
            start_date:     form.startDate,
            end_date:       form.endDate,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)

      if (spaceInserts.length > 0) {
        const { error: saErr } = await supabase
          .from('booking_space_assignments')
          .insert(spaceInserts)
        if (saErr) throw new Error(saErr.message)
      }

      onCreated(booking.id)
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Something went wrong. Please try again.' })
      setSaving(false)
    }
  }

  const inputBase = [
    'w-full px-3.5 py-3 text-sm text-slate-900 bg-white rounded-lg border transition-colors',
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0',
    'focus:ring-emerald-500 focus:border-transparent',
  ].join(' ')

  const hasPets = petsForAssignment.length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New booking"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save booking</Button>
        </>
      }
    >
      <div className="space-y-5">
        {errors.general && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            {errors.general}
          </div>
        )}

        {/* Owner */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-700">
            Owner <span className="text-red-500" aria-hidden="true">*</span>
          </p>
          {selectedOwner ? (
            <div className={[inputBase, 'flex items-center justify-between'].join(' ')} style={{ border: '1px solid #d1d5db' }}>
              <span className="text-slate-900">{selectedOwner.first_name} {selectedOwner.last_name}</span>
              <button
                type="button"
                onClick={() => { setField('ownerId', ''); setOwnerPets([]) }}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Clear owner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={ownerSearch}
                onChange={e => setOwnerSearch(e.target.value)}
                placeholder="Search by name…"
                className={[inputBase, errors.ownerId ? 'border-red-400' : 'border-slate-300'].join(' ')}
                autoComplete="off"
              />
              {filteredOwners.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto divide-y divide-slate-100">
                  {filteredOwners.map(o => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onMouseDown={() => selectOwner(o)}
                        className="w-full text-left px-3.5 py-2.5 text-sm text-slate-900 hover:bg-slate-50 transition-colors"
                      >
                        {o.first_name} {o.last_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {errors.ownerId && <p className="text-xs text-red-600">{errors.ownerId}</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            id="nb-start"
            label="Arrival date"
            type="date"
            value={form.startDate}
            onChange={e => setField('startDate', e.target.value)}
            required
            error={errors.startDate}
          />
          <Input
            id="nb-end"
            label="Departure date"
            type="date"
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={e => setField('endDate', e.target.value)}
            required
            error={errors.endDate}
          />
        </div>

        {/* Status */}
        <Select
          id="nb-status"
          label="Status"
          value={form.status}
          onChange={e => setField('status', e.target.value as DbBookingStatus)}
        >
          {SELECTABLE_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>

        {/* Pets */}
        <div className="space-y-2">
          <p className={['text-sm font-medium', errors.pets ? 'text-red-600' : 'text-slate-700'].join(' ')}>
            Pets <span className="text-red-500" aria-hidden="true">*</span>
          </p>

          {!form.ownerId ? (
            <p className="text-sm text-slate-400 italic py-1">Select an owner to see their pets.</p>
          ) : petsLoading ? (
            <p className="text-sm text-slate-400 py-1">Loading pets…</p>
          ) : (
            <>
              {ownerPets.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {ownerPets.map(pet => (
                    <label
                      key={pet.id}
                      className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={form.selectedPetIds.has(pet.id)}
                        onChange={() => togglePet(pet.id)}
                        className="h-4 w-4 rounded border-slate-300 accent-emerald-600 flex-shrink-0"
                      />
                      <span className="text-sm text-slate-900 flex items-center gap-1.5">
                        {pet.species?.icon && <span>{pet.species.icon}</span>}
                        {pet.name}
                        {pet.species && (
                          <span className="text-slate-400 font-normal">({pet.species.name})</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Inline new pet entries */}
              {form.newPets.length > 0 && (
                <div className="space-y-2">
                  {form.newPets.map((np, i) => (
                    <div key={np._key} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={np.name}
                          onChange={e => updateNewPet(np._key, 'name', e.target.value)}
                          placeholder="Pet name"
                          className={[
                            'w-full px-3 py-2.5 text-sm text-slate-900 bg-white rounded-lg border transition-colors',
                            'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-emerald-500 focus:border-transparent',
                            errors[`np_${i}_name`] ? 'border-red-400' : 'border-slate-300',
                          ].join(' ')}
                        />
                        {errors[`np_${i}_name`] && (
                          <p className="text-xs text-red-600">{errors[`np_${i}_name`]}</p>
                        )}
                      </div>
                      <div className="flex-1 space-y-1 relative">
                        <select
                          value={np.speciesId}
                          onChange={e => updateNewPet(np._key, 'speciesId', e.target.value)}
                          className={[
                            'w-full px-3 py-2.5 text-sm text-slate-900 bg-white rounded-lg border appearance-none transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-emerald-500 focus:border-transparent',
                            errors[`np_${i}_species`] ? 'border-red-400' : 'border-slate-300',
                          ].join(' ')}
                        >
                          <option value="">Species…</option>
                          {allSpecies.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        {errors[`np_${i}_species`] && (
                          <p className="text-xs text-red-600">{errors[`np_${i}_species`]}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewPet(np._key)}
                        className="p-2.5 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                        aria-label="Remove pet"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addNewPet}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors py-0.5"
              >
                <Plus className="w-4 h-4" />
                Add a pet not yet in the system
              </button>
            </>
          )}
          {errors.pets && <p className="text-xs text-red-600">{errors.pets}</p>}
        </div>

        {/* Space assignment — per pet */}
        {hasPets && spaces.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Space assignment (optional)</p>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {petsForAssignment.map(pet => {
                // Only show spaces compatible with this pet's species (or all if species unknown)
                const compatibleSpaces = spaces.filter(s =>
                  !pet.speciesId ||
                  s.accommodation_space_species.some(ss => ss.species_id === pet.speciesId)
                )
                const incompatibleSpaces = spaces.filter(s =>
                  pet.speciesId &&
                  !s.accommodation_space_species.some(ss => ss.species_id === pet.speciesId)
                )
                const currentSpaceId = form.spaceAssignments[pet.key] ?? ''
                const hasConflict = spaceIssues.some(
                  i => i.message.includes(pet.name) || i.message.includes(
                    spaces.find(s => s.id === currentSpaceId)?.name ?? '<<<'
                  )
                )
                return (
                  <div key={pet.key} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="text-sm text-slate-700 flex-1 truncate">
                      {pet.name}
                      {pet.speciesName && (
                        <span className="text-slate-400 ml-1.5 font-normal">({pet.speciesName})</span>
                      )}
                    </span>
                    <div className="relative w-52 flex-shrink-0">
                      <select
                        value={currentSpaceId}
                        onChange={e => setSpaceForPet(pet.key, e.target.value)}
                        className={[
                          'w-full pl-3 pr-7 py-2 text-sm bg-white rounded-lg border appearance-none transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-emerald-500 focus:border-transparent',
                          hasConflict ? 'border-red-400 text-red-700' : 'border-slate-300 text-slate-900',
                        ].join(' ')}
                      >
                        <option value="">No space — assign later</option>
                        {compatibleSpaces.length > 0 && spacesByArea
                          .map(group => {
                            const groupSpaces = group.spaces.filter(s =>
                              !pet.speciesId ||
                              s.accommodation_space_species.some(ss => ss.species_id === pet.speciesId)
                            )
                            if (groupSpaces.length === 0) return null
                            return (
                              <optgroup key={group.areaName} label={group.areaName}>
                                {groupSpaces.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </optgroup>
                            )
                          })
                        }
                        {incompatibleSpaces.length > 0 && (
                          <optgroup label="⚠ Incompatible species">
                            {incompatibleSpaces.map(s => (
                              <option key={s.id} value={s.id} disabled>{s.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                        <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Validation messages */}
            {spaceIssues.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 space-y-1">
                {spaceIssues.map((issue, i) => (
                  <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {issue.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <Textarea
          id="nb-notes"
          label="Notes"
          value={form.notes}
          onChange={e => setField('notes', e.target.value)}
          rows={3}
          placeholder="Any additional notes for this booking…"
        />
      </div>
    </Modal>
  )
}

// ─── Booking list row ─────────────────────────────────────────────────────────

type BookingListRow = {
  id: string
  status: DbBookingStatus
  start_date: string
  end_date: string
  owner: Pick<Owner, 'id' | 'first_name' | 'last_name'> | null
  booking_pets: { pet: { id: string; name: string } | null }[]
}

function BookingRow({ booking }: { booking: BookingListRow }) {
  const petNames = booking.booking_pets
    .map(bp => bp.pet?.name)
    .filter(Boolean)
    .join(', ') || 'No pets added'

  const nights = nightsBetween(booking.start_date, booking.end_date)

  return (
    <li>
      <Link
        to={`/bookings/${booking.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex-shrink-0 w-40 hidden sm:block">
          <StatusBadge status={dbStatusToUi(booking.status)} />
        </div>
        <div className="sm:hidden">
          <StatusBadge status={dbStatusToUi(booking.status)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {booking.owner?.first_name} {booking.owner?.last_name}
          </p>
          <p className="text-xs text-slate-500 truncate">{petNames}</p>
        </div>
        <div className="text-right flex-shrink-0 hidden sm:block">
          <p className="text-sm text-slate-700">{formatBookingDate(booking.start_date)}</p>
          <p className="text-xs text-slate-400">{nights} night{nights !== 1 ? 's' : ''}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
      </Link>
    </li>
  )
}

// ─── BookingsPage ─────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const navigate = useNavigate()
  const [bookings,     setBookings]     = useState<BookingListRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [newOpen,      setNewOpen]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<DbBookingStatus | 'all'>('all')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select(`
        id, status, start_date, end_date,
        owner:owner_id ( id, first_name, last_name ),
        booking_pets ( pet:pet_id ( id, name ) )
      `)
      .order('start_date', { ascending: false })
    setBookings((data ?? []) as unknown as BookingListRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const statusesPresent = useMemo(() => {
    const s = new Set(bookings.map(b => b.status))
    return SELECTABLE_STATUSES.filter(ss => s.has(ss.value))
  }, [bookings])

  const filtered = useMemo(() => {
    let list = bookings
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(b =>
        `${b.owner?.first_name ?? ''} ${b.owner?.last_name ?? ''}`.toLowerCase().includes(q)
      )
    }
    return list
  }, [bookings, statusFilter, search])

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Bookings"
        description="All bookings, sorted by arrival date"
        action={
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setNewOpen(true)}
          >
            New booking
          </Button>
        }
      />

      {/* Status filter chips */}
      {statusesPresent.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {([{ value: 'all', label: `All (${bookings.length})` }] as { value: DbBookingStatus | 'all'; label: string }[])
            .concat(statusesPresent.map(s => ({
              value: s.value as DbBookingStatus | 'all',
              label: `${s.label} (${bookings.filter(b => b.status === s.value).length})`,
            })))
            .map(chip => {
              const active = statusFilter === chip.value
              return (
                <button
                  key={chip.value}
                  onClick={() => setStatusFilter(chip.value)}
                  className={[
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    active ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  ].join(' ')}
                  style={active ? { backgroundColor: 'var(--brand-primary)' } : {}}
                >
                  {chip.label}
                </button>
              )
            })}
        </div>
      )}

      {/* Search */}
      {bookings.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by owner name…"
            className="w-full max-w-xs px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
          />
        </div>
      )}

      {loading ? (
        <Card><p className="text-sm text-slate-400 text-center py-4">Loading…</p></Card>
      ) : bookings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="w-6 h-6" />}
            title="No bookings yet"
            description="Click 'New booking' to take your first reservation."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400 text-center py-6 italic">No bookings match your filter.</p>
        </Card>
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-slate-100">
            {filtered.map(b => <BookingRow key={b.id} booking={b} />)}
          </ul>
        </Card>
      )}

      <NewBookingModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={bookingId => { setNewOpen(false); navigate(`/bookings/${bookingId}`) }}
      />
    </div>
  )
}
