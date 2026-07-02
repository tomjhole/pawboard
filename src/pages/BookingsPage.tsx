import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, CalendarDays, X, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import {
  PageHeader, Card, Button, Modal, Input, Textarea, EmptyState,
  StatusBadge, PaymentBadge, type BookingStatus,
} from '@/components/ui'
import type { Database } from '@/types/database'
import { logAudit } from '@/lib/audit'
import { todayIso, addDays } from '@/lib/reports'
import { paymentStatusOf } from '@/lib/payments'
import { canEdit as canEditRole } from '@/lib/roles'

// ─── Types & constants ────────────────────────────────────────────────────────

export type DbBookingStatus = Database['public']['Enums']['booking_status']
export type DisplayBookingStatus = DbBookingStatus | 'overdue'
type Owner   = Database['public']['Tables']['owners']['Row']
type Species = Database['public']['Tables']['species']['Row']

export const STATUS_LABELS: Record<DisplayBookingStatus, string> = {
  enquiry:             'Enquiry',
  confirmed:           'Confirmed',
  details_outstanding: 'Details outstanding',
  ready:               'Ready for arrival',
  checked_in:          'Checked in',
  due_out:             'Due out today',
  checked_out:         'Checked out',
  cancelled:           'Cancelled',
  waiting_list:        'Waiting list',
  overdue:             'Overdue checkout',
}

export const SELECTABLE_STATUSES: { value: DbBookingStatus; label: string }[] = [
  { value: 'enquiry',      label: 'Enquiry'      },
  { value: 'confirmed',    label: 'Confirmed'    },
  { value: 'waiting_list', label: 'Waiting list' },
  { value: 'checked_in',   label: 'Checked in'   },
  { value: 'checked_out',  label: 'Checked out'  },
  { value: 'cancelled',    label: 'Cancelled'    },
]

// Statuses set via process buttons only (no dropdown).
export const INTENT_STATUSES: { value: DbBookingStatus; label: string }[] = [
  { value: 'enquiry',      label: 'Enquiry'      },
  { value: 'confirmed',    label: 'Confirmed'    },
  { value: 'waiting_list', label: 'Waiting list' },
]

export const INTENT_STATUS_SET = new Set<DbBookingStatus>(['enquiry', 'confirmed', 'waiting_list'])

// Statuses whose space assignments actually hold a space for the booking's dates.
// Anything here occupies its kennel/cabin; enquiry/waiting_list have no assignment,
// cancelled is void, and checked_out has left (space freed).
export const OCCUPYING_STATUSES = ['confirmed', 'details_outstanding', 'ready', 'checked_in', 'due_out'] as const

// Per-space occupancy for a date range: how many pets, and which households (owners).
export type SpaceOccupancy = { count: number; ownerIds: Set<string> }

// Returns the status to display — overrides to details_outstanding when a pre-event
// booking has genuinely missing info, so the badge reflects the real state.
export function computeDisplayStatus(
  stored: DbBookingStatus,
  hasOutstanding: boolean,
  endDate?: string | null,
): DisplayBookingStatus {
  if (hasOutstanding && INTENT_STATUS_SET.has(stored)) { return 'details_outstanding' }
  if (endDate && (stored === 'checked_in' || stored === 'due_out') && endDate < todayIso()) { return 'overdue' }
  return stored
}

export function hasOutstandingDetails(booking: {
  owner: {
    emergency_contact_name?: string | null
    emergency_contact_phone?: string | null
  } | null
}): boolean {
  const o = booking.owner
  return !!(o && (!o.emergency_contact_name || !o.emergency_contact_phone))
}

function bsDaysSince(iso: string): number {
  const now = new Date(); now.setHours(12, 0, 0, 0)
  return Math.round((now.getTime() - new Date(iso + 'T12:00:00').getTime()) / 86400000)
}

export function petHasCriticalIssues(pet: {
  vaccinations:         { is_verified: boolean }[]
  flea_treatment_date:  string | null | undefined
  worming_treatment_date: string | null | undefined
}): boolean {
  if (!pet.vaccinations.some(v => v.is_verified)) return true
  if (!pet.flea_treatment_date || bsDaysSince(pet.flea_treatment_date) > 30) return true
  if (!pet.worming_treatment_date || bsDaysSince(pet.worming_treatment_date) > 90) return true
  return false
}

export function dbStatusToUi(s: DisplayBookingStatus): BookingStatus {
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
  existingOccupancy: Map<string, SpaceOccupancy>,
  currentOwnerId: string,
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

    const occ = existingOccupancy.get(spaceId)
    const existingCount = occ?.count ?? 0

    // Same-household-only — hard block if another household already holds it
    if (space.same_household_only && [...(occ?.ownerIds ?? [])].some(o => o !== currentOwnerId)) {
      issues.push({
        message: `${space.name} is already booked by another household for these dates — it only takes one household at a time.`,
        blocking: true,
      })
    }

    // Capacity — includes pets already assigned by other bookings for these dates
    const totalCount = existingCount + assigned.length
    if (totalCount > space.max_pets) {
      if (existingCount >= space.max_pets) {
        issues.push({
          message: `${space.name} is already fully booked for these dates.`,
          blocking: true,
        })
      } else {
        issues.push({
          message: `${space.name} holds ${space.max_pets} pet${space.max_pets !== 1 ? 's' : ''} — ${existingCount} already assigned, adding ${assigned.length} more would exceed capacity.`,
          blocking: true,
        })
      }
    }
  }

  return issues
}

// ─── NewBookingModal ──────────────────────────────────────────────────────────

export interface NewBookingModalProps {
  open: boolean
  onClose: () => void
  onCreated: (bookingId: string) => void
  /** Prefill when opened from a calendar cell. */
  initialSpaceId?: string
  initialStartDate?: string
  /** Latest allowed departure (day before the next booking in that space). */
  maxEndDate?: string
}

export function NewBookingModal({ open, onClose, onCreated, initialSpaceId, initialStartDate, maxEndDate }: NewBookingModalProps) {
  const { business } = useBusinessContext()

  const [form,        setForm]        = useState<BookingForm>(EMPTY_FORM)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [owners,      setOwners]      = useState<OwnerOption[]>([])
  const [petIndex,    setPetIndex]    = useState<Map<string, string[]>>(new Map())  // ownerId → pet names
  const [ownerPets,   setOwnerPets]   = useState<OwnerPetOpt[]>([])
  const [allSpecies,  setAllSpecies]  = useState<Species[]>([])
  const [spaces,      setSpaces]      = useState<SpaceWithSpecies[]>([])
  const [saving,        setSaving]        = useState(false)
  const [errors,        setErrors]        = useState<Record<string, string>>({})
  const [petsLoading,   setPetsLoading]   = useState(false)
  const [occupancyMap,  setOccupancyMap]  = useState<Map<string, SpaceOccupancy>>(new Map())
  const [newOwnerForm,  setNewOwnerForm]  = useState<{ firstName: string; lastName: string; phone: string } | null>(null)

  // Load reference data when modal opens
  useEffect(() => {
    if (!open) return
    setForm({
      ...EMPTY_FORM,
      startDate: initialStartDate ?? '',
      // Default to a 1-night stay when opened from a calendar cell, capped to availability.
      endDate: initialStartDate
        ? (maxEndDate && addDays(initialStartDate, 1) > maxEndDate ? maxEndDate : addDays(initialStartDate, 1))
        : '',
    })
    setOwnerSearch('')
    setOwnerPets([])
    setErrors({})
    setNewOwnerForm(null)
    Promise.all([
      supabase.from('owners').select('id, first_name, last_name').eq('is_active', true).order('last_name').order('first_name'),
      supabase.from('species').select('*').order('is_system_default', { ascending: false }).order('sort_order').order('name'),
      supabase.from('accommodation_spaces').select(SPACES_QUERY).eq('is_active', true).order('sort_order'),
      supabase.from('pets').select('name, owner_id').eq('is_active', true),
    ]).then(([ownersRes, speciesRes, spacesRes, petsRes]) => {
      setOwners(ownersRes.data ?? [])
      setAllSpecies(speciesRes.data ?? [])
      setSpaces((spacesRes.data ?? []) as unknown as SpaceWithSpecies[])
      const idx = new Map<string, string[]>()
      for (const p of (petsRes.data ?? []) as { name: string; owner_id: string }[]) {
        const list = idx.get(p.owner_id) ?? []
        list.push(p.name)
        idx.set(p.owner_id, list)
      }
      setPetIndex(idx)
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

  // Fetch occupied space counts for confirmed/active bookings in the selected date range.
  useEffect(() => {
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) {
      setOccupancyMap(new Map())
      return
    }
    supabase
      .from('bookings')
      .select('owner_id, booking_pets(booking_space_assignments(space_id))')
      .in('status', OCCUPYING_STATUSES)
      // Strict overlap: a booking ending on day X does not clash with one starting on X
      // (checkout frees the space that morning). end_date is the checkout day, not a night.
      .lt('start_date', form.endDate)
      .gt('end_date', form.startDate)
      .then(({ data }) => {
        const map = new Map<string, SpaceOccupancy>()
        for (const b of data ?? []) {
          for (const bp of (b as any).booking_pets ?? []) {
            for (const sa of bp.booking_space_assignments ?? []) {
              const occ = map.get(sa.space_id) ?? { count: 0, ownerIds: new Set<string>() }
              occ.count += 1
              if ((b as any).owner_id) occ.ownerIds.add((b as any).owner_id)
              map.set(sa.space_id, occ)
            }
          }
        }
        setOccupancyMap(map)
      })
  }, [form.startDate, form.endDate])

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
    () => validateSpaces(form.spaceAssignments, petsForAssignment, spaces, occupancyMap, form.ownerId),
    [form.spaceAssignments, petsForAssignment, spaces, occupancyMap, form.ownerId]
  )

  const filteredOwners = useMemo<{ owner: OwnerOption; viaPet?: string }[]>(
    () => {
      const q = ownerSearch.trim().toLowerCase()
      if (!q) return []
      const out: { owner: OwnerOption; viaPet?: string }[] = []
      for (const o of owners) {
        if (`${o.first_name} ${o.last_name}`.toLowerCase().includes(q)) {
          out.push({ owner: o })
        } else {
          const pet = (petIndex.get(o.id) ?? []).find(n => n.toLowerCase().includes(q))
          if (pet) out.push({ owner: o, viaPet: pet })
        }
        if (out.length >= 10) break
      }
      return out
    },
    [owners, petIndex, ownerSearch]
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

  // Arrival changes preserve the number of nights (shift departure); a departure
  // now earlier than the new arrival is cleared.
  function setStartDate(v: string) {
    setForm(f => {
      const n = f.startDate && f.endDate && f.endDate >= f.startDate ? nightsBetween(f.startDate, f.endDate) : null
      let end = f.endDate
      if (v && n && n > 0) {
        end = addDays(v, n)
        if (maxEndDate && end > maxEndDate) end = maxEndDate
      } else if (v && f.endDate && f.endDate < v) {
        end = ''
      }
      return { ...f, startDate: v, endDate: end }
    })
    clearError('startDate'); clearError('endDate')
  }

  // Nights and departure calculate each other (arrival is the anchor).
  function setNights(nStr: string) {
    const n = parseInt(nStr, 10)
    if (!form.startDate || isNaN(n) || n < 1) return
    let end = addDays(form.startDate, n)
    if (maxEndDate && end > maxEndDate) end = maxEndDate
    setField('endDate', end)
  }

  const nights = form.startDate && form.endDate && form.endDate >= form.startDate
    ? nightsBetween(form.startDate, form.endDate) : null

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
      // When opened from a calendar cell, default the pet into that space.
      const sa = initialSpaceId ? { ...f.spaceAssignments, [petId]: initialSpaceId } : f.spaceAssignments
      return { ...f, selectedPetIds: next, spaceAssignments: sa }
    })
    clearError('pets')
  }

  function addNewPet() {
    setForm(f => {
      const key = crypto.randomUUID()
      const sa = initialSpaceId ? { ...f.spaceAssignments, [key]: initialSpaceId } : f.spaceAssignments
      return { ...f, newPets: [...f.newPets, { _key: key, name: '', speciesId: '' }], spaceAssignments: sa }
    })
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

  // Fill in any unassigned pets with the first compatible space that still has
  // room, packing pets into shared spaces (e.g. siblings into one cabin) before
  // moving on. Existing manual assignments are left untouched.
  function autoAssignSpaces() {
    // Running count + households per space, seeded from other bookings then this draft.
    const counts = new Map<string, number>()
    const owners = new Map<string, Set<string>>()
    for (const [sid, occ] of occupancyMap) {
      counts.set(sid, occ.count)
      owners.set(sid, new Set(occ.ownerIds))
    }
    for (const spaceId of Object.values(form.spaceAssignments)) {
      if (spaceId) {
        counts.set(spaceId, (counts.get(spaceId) ?? 0) + 1)
        if (form.ownerId) (owners.get(spaceId) ?? owners.set(spaceId, new Set()).get(spaceId)!).add(form.ownerId)
      }
    }
    const next = { ...form.spaceAssignments }
    for (const pet of petsForAssignment) {
      if (next[pet.key]) continue
      const target = spaces.find(s => {
        const speciesOk = !pet.speciesId || s.accommodation_space_species.some(ss => ss.species_id === pet.speciesId)
        const hasRoom   = (counts.get(s.id) ?? 0) < s.max_pets
        const householdOk = !s.same_household_only ||
          ![...(owners.get(s.id) ?? [])].some(o => o !== form.ownerId)
        return speciesOk && hasRoom && householdOk
      })
      if (target) {
        next[pet.key] = target.id
        counts.set(target.id, (counts.get(target.id) ?? 0) + 1)
        if (form.ownerId) (owners.get(target.id) ?? owners.set(target.id, new Set()).get(target.id)!).add(form.ownerId)
      }
    }
    setForm(f => ({ ...f, spaceAssignments: next }))
  }

  function startNewOwner() {
    const parts = ownerSearch.trim().split(/\s+/)
    setNewOwnerForm({
      firstName: parts[0] ?? '',
      lastName:  parts.slice(1).join(' '),
      phone:     '',
    })
    setOwnerSearch('')
    setForm(f => ({ ...f, ownerId: '', selectedPetIds: new Set(), newPets: [], spaceAssignments: {} }))
    clearError('ownerId')
  }

  function cancelNewOwner() {
    setNewOwnerForm(null)
  }

  async function handleSave() {
    if (!business) return
    const errs: Record<string, string> = {}
    if (!form.ownerId && !newOwnerForm) errs.ownerId = 'Select or add an owner'
    if (newOwnerForm) {
      if (!newOwnerForm.firstName.trim()) errs.newOwnerFirstName = 'First name required'
      if (!newOwnerForm.lastName.trim())  errs.newOwnerLastName  = 'Last name required'
      if (!newOwnerForm.phone.trim())     errs.newOwnerPhone     = 'Phone number required'
    }
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

    // Block on pre-computed space validation errors (species, capacity within form)
    if (spaceIssues.some(i => i.blocking)) {
      errs.spaces = 'Fix space assignment errors before saving.'
    }

    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    try {
      // 0. Create new owner if entering one inline
      let ownerId = form.ownerId
      if (newOwnerForm) {
        const { data: ownerData, error: ownerErr } = await supabase
          .from('owners')
          .insert({
            business_id: business.id,
            first_name:  newOwnerForm.firstName.trim(),
            last_name:   newOwnerForm.lastName.trim(),
            phone:       newOwnerForm.phone.trim(),
            is_active:   true,
          })
          .select('id')
          .single()
        if (ownerErr) throw new Error(ownerErr.message)
        ownerId = ownerData.id
      }

      // Server-side conflict check — re-query fresh data at save time.
      // Query bookings downward to avoid FK join ambiguity in reverse direction.
      const assignedSpaceIds = [...new Set(Object.values(form.spaceAssignments).filter(Boolean))]
      if (assignedSpaceIds.length > 0) {
        const { data: conflicting } = await supabase
          .from('bookings')
          .select('booking_pets(booking_space_assignments(space_id))')
          .in('status', OCCUPYING_STATUSES)
          .lt('start_date', form.endDate)
          .gt('end_date', form.startDate)

        const existingCounts = new Map<string, number>()
        for (const b of conflicting ?? []) {
          for (const bp of (b as any).booking_pets ?? []) {
            for (const sa of bp.booking_space_assignments ?? []) {
              if (assignedSpaceIds.includes(sa.space_id)) {
                existingCounts.set(sa.space_id, (existingCounts.get(sa.space_id) ?? 0) + 1)
              }
            }
          }
        }
        const newCounts = new Map<string, number>()
        for (const spaceId of Object.values(form.spaceAssignments)) {
          if (spaceId) newCounts.set(spaceId, (newCounts.get(spaceId) ?? 0) + 1)
        }
        for (const spaceId of assignedSpaceIds) {
          const space = spaces.find(s => s.id === spaceId)
          if (!space) continue
          if ((existingCounts.get(spaceId) ?? 0) + (newCounts.get(spaceId) ?? 0) > space.max_pets) {
            setErrors({ general: `"${space.name}" is already fully booked for those dates — please choose a different space.` })
            setSaving(false)
            return
          }
        }
      }

      // Auto-determine status: confirmed if any space assigned, enquiry otherwise
      const autoStatus: DbBookingStatus = assignedSpaceIds.length > 0 ? 'confirmed' : 'enquiry'

      // 1. Create minimal pet records for new pets; track _key → new pet_id
      const keyToNewPetId = new Map<string, string>()
      for (const np of form.newPets) {
        const { data, error } = await supabase
          .from('pets')
          .insert({
            business_id: business.id,
            owner_id:    ownerId,
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
          owner_id:    ownerId,
          status:      autoStatus,
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

      await logAudit(business.id, {
        action:      'booking.created',
        entity_type: 'booking',
        entity_id:   booking.id,
        after: { status: autoStatus, start_date: form.startDate, end_date: form.endDate },
      })
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

          {newOwnerForm !== null ? (
            /* ── Inline new-owner form ── */
            <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">New owner</span>
                <button type="button" onClick={cancelNewOwner} className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Cancel new owner">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <input
                    type="text"
                    value={newOwnerForm.firstName}
                    onChange={e => { setNewOwnerForm(f => f ? { ...f, firstName: e.target.value } : f); clearError('newOwnerFirstName') }}
                    placeholder="First name *"
                    className={[inputBase, errors.newOwnerFirstName ? 'border-red-400' : 'border-slate-300'].join(' ')}
                  />
                  {errors.newOwnerFirstName && <p className="text-xs text-red-600">{errors.newOwnerFirstName}</p>}
                </div>
                <div className="space-y-0.5">
                  <input
                    type="text"
                    value={newOwnerForm.lastName}
                    onChange={e => { setNewOwnerForm(f => f ? { ...f, lastName: e.target.value } : f); clearError('newOwnerLastName') }}
                    placeholder="Last name *"
                    className={[inputBase, errors.newOwnerLastName ? 'border-red-400' : 'border-slate-300'].join(' ')}
                  />
                  {errors.newOwnerLastName && <p className="text-xs text-red-600">{errors.newOwnerLastName}</p>}
                </div>
              </div>
              <div className="space-y-0.5">
                <input
                  type="tel"
                  value={newOwnerForm.phone}
                  onChange={e => { setNewOwnerForm(f => f ? { ...f, phone: e.target.value } : f); clearError('newOwnerPhone') }}
                  placeholder="Phone number *"
                  className={[inputBase, errors.newOwnerPhone ? 'border-red-400' : 'border-slate-300'].join(' ')}
                />
                {errors.newOwnerPhone && <p className="text-xs text-red-600">{errors.newOwnerPhone}</p>}
              </div>
            </div>
          ) : selectedOwner ? (
            /* ── Existing owner chip ── */
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
            /* ── Search box ── */
            <div className="relative">
              <input
                type="text"
                value={ownerSearch}
                onChange={e => setOwnerSearch(e.target.value)}
                placeholder="Search by name…"
                className={[inputBase, errors.ownerId ? 'border-red-400' : 'border-slate-300'].join(' ')}
                autoComplete="off"
              />
              {(filteredOwners.length > 0 || ownerSearch.trim().length > 0) && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
                  {filteredOwners.map(({ owner: o, viaPet }) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onMouseDown={() => selectOwner(o)}
                        className="w-full text-left px-3.5 py-2.5 text-sm text-slate-900 hover:bg-slate-50 transition-colors"
                      >
                        {o.first_name} {o.last_name}
                        {viaPet && <span className="text-slate-400"> · {viaPet}</span>}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onMouseDown={startNewOwner}
                      className="w-full text-left px-3.5 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                      {ownerSearch.trim()
                        ? `Add "${ownerSearch.trim()}" as new owner`
                        : 'Add new owner'}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}
          {errors.ownerId && <p className="text-xs text-red-600">{errors.ownerId}</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_5rem] gap-4">
          <Input
            id="nb-start"
            label="Arrival date"
            type="date"
            value={form.startDate}
            onChange={e => setStartDate(e.target.value)}
            required
            error={errors.startDate}
          />
          <Input
            id="nb-end"
            label="Departure date"
            type="date"
            value={form.endDate}
            min={form.startDate || undefined}
            max={maxEndDate || undefined}
            onChange={e => setField('endDate', e.target.value)}
            required
            error={errors.endDate}
          />
          <Input
            id="nb-nights"
            label="Nights"
            type="number"
            min="1"
            value={nights ?? ''}
            onChange={e => setNights(e.target.value)}
            disabled={!form.startDate}
          />
        </div>
        {maxEndDate && (
          <p className="-mt-3 text-xs text-slate-400">
            {form.startDate} is free in this space until {formatBookingDate(maxEndDate)} — the next booking starts after that.
          </p>
        )}

        {/* Pets */}
        <div className="space-y-2">
          <p className={['text-sm font-medium', errors.pets ? 'text-red-600' : 'text-slate-700'].join(' ')}>
            Pets <span className="text-red-500" aria-hidden="true">*</span>
          </p>

          {!form.ownerId && !newOwnerForm ? (
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Space assignment (optional)</p>
              <button
                type="button"
                onClick={autoAssignSpaces}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                Auto-assign
              </button>
            </div>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {(() => {
                // Other pets already assigned in this draft occupy their space too —
                // count them alongside existing DB occupancy so one dropdown can't
                // offer a space another pet in the same booking has just taken.
                const draftCounts = new Map<string, number>()
                for (const spaceId of Object.values(form.spaceAssignments)) {
                  if (spaceId) draftCounts.set(spaceId, (draftCounts.get(spaceId) ?? 0) + 1)
                }
                return petsForAssignment.map(pet => {
                const speciesMatch = (s: SpaceWithSpecies) =>
                  !pet.speciesId ||
                  s.accommodation_space_species.some(ss => ss.species_id === pet.speciesId)

                const compatibleSpaces = spaces.filter(s => speciesMatch(s))
                const currentSpaceId = form.spaceAssignments[pet.key] ?? ''

                // Effective occupancy = DB occupancy + other pets in this draft,
                // minus 1 if this pet itself already holds that space.
                const effectiveCount = (s: SpaceWithSpecies) => {
                  const total = (occupancyMap.get(s.id)?.count ?? 0) + (draftCounts.get(s.id) ?? 0)
                  return currentSpaceId === s.id ? total - 1 : total
                }
                // A same-household-only space is blocked if another household holds it.
                const householdBlocked = (s: SpaceWithSpecies) =>
                  s.same_household_only &&
                  [...(occupancyMap.get(s.id)?.ownerIds ?? [])].some(o => o !== form.ownerId)

                const isAvailable = (s: SpaceWithSpecies) =>
                  s.id === currentSpaceId || (effectiveCount(s) < s.max_pets && !householdBlocked(s))

                // Split compatible spaces into available vs. fully booked for these dates
                const availableSpaces = compatibleSpaces.filter(s => isAvailable(s))
                const fullyBookedSpaces = compatibleSpaces.filter(s => !isAvailable(s))
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
                        {availableSpaces.length > 0 && spacesByArea
                          .map(group => {
                            const groupSpaces = group.spaces.filter(s =>
                              speciesMatch(s) && isAvailable(s)
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
                        {fullyBookedSpaces.length > 0 && (
                          <optgroup label="⚠ Already booked these dates">
                            {fullyBookedSpaces.map(s => (
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
                })
              })()}
            </div>

            {/* Validation messages */}
            {(spaceIssues.length > 0 || errors.spaces) && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 space-y-1">
                {spaceIssues.map((issue, i) => (
                  <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {issue.message}
                  </p>
                ))}
                {errors.spaces && (
                  <p className="text-xs text-red-700 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {errors.spaces}
                  </p>
                )}
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
  total_amount: number | null
  amount_paid: number
  deposit_paid: boolean
  balance_paid: boolean
  owner: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    address_line1: string | null
    city: string | null
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
  } | null
  booking_pets: {
    pet: {
      id: string
      name: string
      vet_practice_name: string | null
      vet_phone: string | null
      microchip_number: string | null
      species: { name: string; icon: string | null } | null
    } | null
  }[]
}

function PaymentChip({ booking }: { booking: BookingListRow }) {
  if (booking.total_amount == null || booking.status === 'cancelled') return null
  return <PaymentBadge status={paymentStatusOf(booking)} />
}

function BookingRow({ booking }: { booking: BookingListRow }) {
  const pets = booking.booking_pets.map(bp => bp.pet).filter(Boolean) as NonNullable<BookingListRow['booking_pets'][number]['pet']>[]
  const nights = nightsBetween(booking.start_date, booking.end_date)
  const displayStatus = computeDisplayStatus(booking.status, hasOutstandingDetails(booking), booking.end_date)

  return (
    <li>
      <Link
        to={`/bookings/${booking.id}`}
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex-shrink-0 w-36 hidden sm:block">
          <StatusBadge status={dbStatusToUi(displayStatus)} />
        </div>
        <div className="sm:hidden flex-shrink-0">
          <StatusBadge status={dbStatusToUi(displayStatus)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {booking.owner?.first_name} {booking.owner?.last_name}
          </p>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {pets.length === 0 ? 'No pets' : pets.map(p => (
              <span key={p.id} className="mr-2">
                {p.species?.icon && <span className="mr-0.5">{p.species.icon}</span>}
                {p.name}
              </span>
            ))}
          </p>
        </div>
        <div className="text-right flex-shrink-0 hidden sm:block">
          <p className="text-xs font-medium text-slate-700">{formatBookingDate(booking.start_date)}</p>
          <p className="text-xs text-slate-400">{nights} night{nights !== 1 ? 's' : ''}</p>
          <div className="mt-1"><PaymentChip booking={booking} /></div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
      </Link>
    </li>
  )
}

// ─── BookingsPage ─────────────────────────────────────────────────────────────

const PAST_STATUSES = new Set<DbBookingStatus>(['checked_out', 'cancelled'])

export default function BookingsPage() {
  const navigate = useNavigate()
  const { staffUser, isAdmin } = useBusinessContext()
  const canEdit = isAdmin || canEditRole(staffUser?.role ?? 'read_only')
  const [bookings,     setBookings]     = useState<BookingListRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [newOpen,      setNewOpen]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<DbBookingStatus | 'all'>('all')
  const [showPast,     setShowPast]     = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select(`
        id, status, start_date, end_date, total_amount, amount_paid, deposit_paid, balance_paid,
        owner:owner_id ( id, first_name, last_name, email, address_line1, city, emergency_contact_name, emergency_contact_phone ),
        booking_pets ( pet:pet_id ( id, name, vet_practice_name, vet_phone, microchip_number,
          species:species_id ( name, icon ) ) )
      `)
      .order('start_date', { ascending: true })
    setBookings((data ?? []) as unknown as BookingListRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const visibleBookings = useMemo(
    () => showPast ? bookings : bookings.filter(b => !PAST_STATUSES.has(b.status)),
    [bookings, showPast],
  )

  const statusesPresent = useMemo(() => {
    const s = new Set(visibleBookings.map(b => b.status))
    return SELECTABLE_STATUSES.filter(ss => s.has(ss.value))
  }, [visibleBookings])

  const filtered = useMemo(() => {
    let list = visibleBookings
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(b => {
        if (`${b.owner?.first_name ?? ''} ${b.owner?.last_name ?? ''}`.toLowerCase().includes(q)) return true
        if (b.booking_pets.some(bp => bp.pet?.name.toLowerCase().includes(q))) return true
        return false
      })
    }
    return list
  }, [visibleBookings, statusFilter, search])

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Bookings"
        action={
          canEdit ? (
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setNewOpen(true)}>
              New booking
            </Button>
          ) : undefined
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search owner or pet…"
          className="flex-1 min-w-[160px] max-w-xs px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPast}
            onChange={e => { setShowPast(e.target.checked); setStatusFilter('all') }}
            className="rounded border-slate-300"
          />
          Show past
        </label>
      </div>

      {/* Status chips */}
      {statusesPresent.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {([{ value: 'all' as const, label: `All (${visibleBookings.length})` }] as { value: DbBookingStatus | 'all'; label: string }[])
            .concat(statusesPresent.map(s => ({
              value: s.value as DbBookingStatus | 'all',
              label: `${s.label} (${visibleBookings.filter(b => b.status === s.value).length})`,
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
          <p className="text-sm text-slate-400 text-center py-6 italic">No bookings match your filters.</p>
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
