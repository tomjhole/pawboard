import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronRight, PawPrint } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card, Button, Input, Select, Textarea, Modal, EmptyState } from '@/components/ui'
import type { Database } from '@/types/database'

type PetSex  = Database['public']['Enums']['pet_sex']
type PetSize = Database['public']['Enums']['pet_size']
type Owner   = Database['public']['Tables']['owners']['Row']
type Species = Database['public']['Tables']['species']['Row']

export type PetWithRelations = Database['public']['Tables']['pets']['Row'] & {
  owner:   Pick<Owner, 'id' | 'first_name' | 'last_name'> | null
  species: Pick<Species, 'id' | 'name' | 'plural_name' | 'icon' | 'colour'> | null
}

export interface PetForm {
  name:                  string
  ownerId:               string
  speciesId:             string
  breed:                 string
  sex:                   PetSex
  isNeutered:            '' | 'yes' | 'no'
  dateOfBirth:           string
  size:                  PetSize | ''
  colourMarkings:        string
  microchipNumber:       string
  photoUrl:              string
  vetPracticeName:       string
  vetName:               string
  vetPhone:              string
  vetAddress:            string
  insuranceProvider:     string
  insurancePolicyNumber: string
  medicalNotes:          string
  behaviourNotes:        string
  feedingInstructions:   string
}

export const EMPTY_PET_FORM: PetForm = {
  name: '', ownerId: '', speciesId: '', breed: '', sex: 'unknown',
  isNeutered: '', dateOfBirth: '', size: '', colourMarkings: '',
  microchipNumber: '', photoUrl: '', vetPracticeName: '', vetName: '',
  vetPhone: '', vetAddress: '', insuranceProvider: '',
  insurancePolicyNumber: '', medicalNotes: '', behaviourNotes: '',
  feedingInstructions: '',
}

export const SIZE_LABELS: Record<PetSize, string> = {
  toy: 'Toy', small: 'Small', medium: 'Medium', large: 'Large', giant: 'Giant',
}

// ─── Pet modal ────────────────────────────────────────────────────────────

export function PetModal({
  open,
  initialPet,
  owners,
  allSpecies,
  defaultOwnerId,
  onClose,
  onSave,
}: {
  open:            boolean
  initialPet:      PetWithRelations | null
  owners:          Pick<Owner, 'id' | 'first_name' | 'last_name'>[]
  allSpecies:      Species[]
  defaultOwnerId?: string
  onClose:         () => void
  onSave:          (form: PetForm, id: string | null) => Promise<void>
}) {
  const isEdit = initialPet !== null

  const [form,        setForm]        = useState<PetForm>(EMPTY_PET_FORM)
  const [errors,      setErrors]      = useState<{ name?: string; ownerId?: string; speciesId?: string }>({})
  const [saving,      setSaving]      = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (initialPet) {
      setForm({
        name:                  initialPet.name,
        ownerId:               initialPet.owner_id,
        speciesId:             initialPet.species_id,
        breed:                 initialPet.breed                   ?? '',
        sex:                   initialPet.sex,
        isNeutered:            initialPet.is_neutered === true ? 'yes' : initialPet.is_neutered === false ? 'no' : '',
        dateOfBirth:           initialPet.date_of_birth           ?? '',
        size:                  initialPet.size                    ?? '',
        colourMarkings:        initialPet.colour_markings         ?? '',
        microchipNumber:       initialPet.microchip_number        ?? '',
        photoUrl:              initialPet.photo_url               ?? '',
        vetPracticeName:       initialPet.vet_practice_name       ?? '',
        vetName:               initialPet.vet_name                ?? '',
        vetPhone:              initialPet.vet_phone               ?? '',
        vetAddress:            initialPet.vet_address             ?? '',
        insuranceProvider:     initialPet.insurance_provider      ?? '',
        insurancePolicyNumber: initialPet.insurance_policy_number ?? '',
        medicalNotes:          initialPet.medical_notes           ?? '',
        behaviourNotes:        initialPet.behaviour_notes         ?? '',
        feedingInstructions:   initialPet.feeding_instructions    ?? '',
      })
    } else {
      setForm({ ...EMPTY_PET_FORM, ownerId: defaultOwnerId ?? '' })
    }
    setErrors({})
    setServerError(null)
  }, [open, initialPet, defaultOwnerId])

  function set<K extends keyof PetForm>(k: K, v: PetForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    if (k === 'name'      && errors.name)      setErrors(p => ({ ...p, name: undefined }))
    if (k === 'ownerId'   && errors.ownerId)   setErrors(p => ({ ...p, ownerId: undefined }))
    if (k === 'speciesId' && errors.speciesId) setErrors(p => ({ ...p, speciesId: undefined }))
  }

  function validate() {
    const errs: typeof errors = {}
    if (!form.name.trim()) errs.name      = 'Pet name is required.'
    if (!form.ownerId)     errs.ownerId   = 'Please select an owner.'
    if (!form.speciesId)   errs.speciesId = 'Please select a species.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setServerError(null)
    try {
      await onSave(form, initialPet?.id ?? null)
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const activeSpecies = allSpecies.filter(s => s.is_active)
  const sortedOwners  = [...owners].sort((a, b) =>
    a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${initialPet.name}` : 'Add pet'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="pet-form" type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Add pet'}
          </Button>
        </>
      }
    >
      <form id="pet-form" onSubmit={handleSubmit} className="space-y-5" noValidate>

        {/* ── About ───────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">About</p>

          <Input
            id="pet-name"
            label="Name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            error={errors.name}
            required
            autoComplete="off"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              id="pet-owner"
              label="Owner"
              value={form.ownerId}
              onChange={e => set('ownerId', e.target.value)}
              error={errors.ownerId}
              required
            >
              <option value="">— Select owner —</option>
              {sortedOwners.map(o => (
                <option key={o.id} value={o.id}>{o.last_name}, {o.first_name}</option>
              ))}
            </Select>

            <Select
              id="pet-species"
              label="Species"
              value={form.speciesId}
              onChange={e => set('speciesId', e.target.value)}
              error={errors.speciesId}
              required
            >
              <option value="">— Select species —</option>
              {activeSpecies.map(s => (
                <option key={s.id} value={s.id}>{s.icon ? `${s.icon} ` : ''}{s.name}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="pet-breed"
              label="Breed"
              value={form.breed}
              onChange={e => set('breed', e.target.value)}
              placeholder="e.g. Labrador, Moggy, Lionhead"
              autoComplete="off"
            />
            <Select
              id="pet-sex"
              label="Sex"
              value={form.sex}
              onChange={e => set('sex', e.target.value as PetSex)}
            >
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              id="pet-neutered"
              label="Neutered / spayed"
              value={form.isNeutered}
              onChange={e => set('isNeutered', e.target.value as PetForm['isNeutered'])}
            >
              <option value="">Not recorded</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
            <Select
              id="pet-size"
              label="Size"
              value={form.size}
              onChange={e => set('size', e.target.value as PetSize | '')}
            >
              <option value="">— Not specified —</option>
              {(Object.keys(SIZE_LABELS) as PetSize[]).map(v => (
                <option key={v} value={v}>{SIZE_LABELS[v]}</option>
              ))}
            </Select>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Physical details ─────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Physical details</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="pet-dob"
              label="Date of birth"
              type="date"
              value={form.dateOfBirth}
              onChange={e => set('dateOfBirth', e.target.value)}
            />
            <Input
              id="pet-microchip"
              label="Microchip number"
              value={form.microchipNumber}
              onChange={e => set('microchipNumber', e.target.value)}
              autoComplete="off"
            />
          </div>
          <Input
            id="pet-colour"
            label="Colour / markings"
            value={form.colourMarkings}
            onChange={e => set('colourMarkings', e.target.value)}
            placeholder="e.g. Black and white, Tabby, Ginger"
            autoComplete="off"
          />
          <Input
            id="pet-photo"
            label="Photo URL"
            type="url"
            value={form.photoUrl}
            onChange={e => set('photoUrl', e.target.value)}
            placeholder="https://…"
            hint="Paste a link to a photo of the pet"
          />
        </div>

        <hr className="border-slate-100" />

        {/* ── Vet details ──────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Vet details</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="pet-vet-practice"
              label="Practice name"
              value={form.vetPracticeName}
              onChange={e => set('vetPracticeName', e.target.value)}
              autoComplete="off"
            />
            <Input
              id="pet-vet-name"
              label="Vet name"
              value={form.vetName}
              onChange={e => set('vetName', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="pet-vet-phone"
              label="Vet phone"
              type="tel"
              value={form.vetPhone}
              onChange={e => set('vetPhone', e.target.value)}
            />
            <Input
              id="pet-vet-address"
              label="Vet address"
              value={form.vetAddress}
              onChange={e => set('vetAddress', e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Insurance ───────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Insurance</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="pet-ins-provider"
              label="Provider"
              value={form.insuranceProvider}
              onChange={e => set('insuranceProvider', e.target.value)}
              autoComplete="off"
            />
            <Input
              id="pet-ins-policy"
              label="Policy number"
              value={form.insurancePolicyNumber}
              onChange={e => set('insurancePolicyNumber', e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Care notes ──────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Care notes</p>
          <Textarea
            id="pet-medical"
            label="Medical notes"
            value={form.medicalNotes}
            onChange={e => set('medicalNotes', e.target.value)}
            rows={3}
            placeholder="Conditions, medications, allergies…"
          />
          <Textarea
            id="pet-behaviour"
            label="Behaviour notes"
            value={form.behaviourNotes}
            onChange={e => set('behaviourNotes', e.target.value)}
            rows={3}
            placeholder="Temperament, triggers, how they interact with others…"
          />
          <Textarea
            id="pet-feeding"
            label="Feeding instructions"
            value={form.feedingInstructions}
            onChange={e => set('feedingInstructions', e.target.value)}
            rows={3}
            placeholder="Portion sizes, times, dietary requirements…"
          />
        </div>

        {serverError && (
          <p className="text-sm text-red-600" role="alert">{serverError}</p>
        )}
      </form>
    </Modal>
  )
}

// ─── Pet row ──────────────────────────────────────────────────────────────

function PetRow({ pet }: { pet: PetWithRelations }) {
  const navigate = useNavigate()
  const species  = pet.species

  return (
    <li>
      <button
        className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
        onClick={() => navigate(`/pets/${pet.id}`)}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 select-none"
          style={{ backgroundColor: species?.colour ? `${species.colour}20` : '#f1f5f9' }}
        >
          {species?.icon ?? '🐾'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900">{pet.name}</p>
            {pet.size && (
              <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                {SIZE_LABELS[pet.size]}
              </span>
            )}
            {!pet.is_active && (
              <span className="text-xs bg-slate-100 text-slate-400 rounded-full px-2 py-0.5">Inactive</span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">
            {pet.owner ? `${pet.owner.first_name} ${pet.owner.last_name}` : 'Unknown owner'}
            {pet.breed ? ` · ${pet.breed}` : ''}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
      </button>
    </li>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function buildPetPayload(form: PetForm) {
  return {
    name:                    form.name.trim(),
    owner_id:                form.ownerId,
    species_id:              form.speciesId,
    breed:                   form.breed.trim()                 || null,
    sex:                     form.sex,
    is_neutered:             form.isNeutered === 'yes' ? true : form.isNeutered === 'no' ? false : null,
    date_of_birth:           form.dateOfBirth                  || null,
    size:                    (form.size || null) as Database['public']['Enums']['pet_size'] | null,
    colour_markings:         form.colourMarkings.trim()        || null,
    microchip_number:        form.microchipNumber.trim()       || null,
    photo_url:               form.photoUrl.trim()              || null,
    vet_practice_name:       form.vetPracticeName.trim()       || null,
    vet_name:                form.vetName.trim()               || null,
    vet_phone:               form.vetPhone.trim()              || null,
    vet_address:             form.vetAddress.trim()            || null,
    insurance_provider:      form.insuranceProvider.trim()     || null,
    insurance_policy_number: form.insurancePolicyNumber.trim() || null,
    medical_notes:           form.medicalNotes.trim()          || null,
    behaviour_notes:         form.behaviourNotes.trim()        || null,
    feeding_instructions:    form.feedingInstructions.trim()   || null,
  }
}

export default function PetsPage() {
  const { business } = useBusinessContext()

  const [pets,          setPets]         = useState<PetWithRelations[]>([])
  const [owners,        setOwners]       = useState<Pick<Owner, 'id' | 'first_name' | 'last_name'>[]>([])
  const [allSpecies,    setAllSpecies]   = useState<Species[]>([])
  const [loading,       setLoading]      = useState(true)
  const [search,        setSearch]       = useState('')
  const [speciesFilter, setSpeciesFilter] = useState('all')
  const [modalOpen,     setModalOpen]    = useState(false)

  async function load() {
    setLoading(true)
    const [petsRes, ownersRes, speciesRes] = await Promise.all([
      supabase
        .from('pets')
        .select(`
          *,
          owner:owner_id ( id, first_name, last_name ),
          species:species_id ( id, name, plural_name, icon, colour )
        `)
        .order('name'),
      supabase
        .from('owners')
        .select('id, first_name, last_name')
        .order('last_name').order('first_name'),
      supabase
        .from('species')
        .select('*')
        .order('is_system_default', { ascending: false })
        .order('sort_order').order('name'),
    ])
    setPets((petsRes.data ?? []) as PetWithRelations[])
    setOwners(ownersRes.data ?? [])
    setAllSpecies(speciesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(form: PetForm, id: string | null) {
    const payload = buildPetPayload(form)
    if (id) {
      const { error } = await supabase.from('pets').update(payload).eq('id', id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from('pets')
        .insert({ ...payload, business_id: business!.id, is_active: true })
      if (error) throw new Error(error.message)
    }
    await load()
  }

  const speciesWithPets = useMemo(() => {
    const ids = new Set(pets.map(p => p.species_id))
    return allSpecies.filter(s => ids.has(s.id))
  }, [pets, allSpecies])

  const filtered = useMemo(() => {
    let result = pets
    if (speciesFilter !== 'all') result = result.filter(p => p.species_id === speciesFilter)
    const term = search.toLowerCase().trim()
    if (term) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.owner ? `${p.owner.first_name} ${p.owner.last_name}`.toLowerCase().includes(term) : false) ||
        (p.breed ?? '').toLowerCase().includes(term)
      )
    }
    return result
  }, [pets, speciesFilter, search])

  const hasPets = !loading && pets.length > 0

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Pets"
        description="Pet profiles and care records"
        action={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
            Add pet
          </Button>
        }
      />

      {/* Species filter chips */}
      {hasPets && speciesWithPets.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[{ id: 'all', name: 'All', plural_name: null, icon: null, colour: null }, ...speciesWithPets].map(s => {
            const active = speciesFilter === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSpeciesFilter(active && s.id !== 'all' ? 'all' : s.id)}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all',
                  active
                    ? 'text-white border-transparent shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white',
                ].join(' ')}
                style={active ? {
                  backgroundColor: s.colour ?? 'var(--brand-primary)',
                  borderColor:     s.colour ?? 'var(--brand-primary)',
                } : {}}
              >
                {s.icon && <span>{s.icon}</span>}
                {s.plural_name ?? s.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Search */}
      {hasPets && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, owner or breed…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      )}

      <Card padding="none">
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-400 text-center">Loading…</div>
        ) : pets.length === 0 ? (
          <EmptyState
            icon={<PawPrint className="w-5 h-5" />}
            title="No pets yet"
            description="Pets are linked to owners. Add a pet and assign them to an existing owner."
            action={
              <Button variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
                Add pet
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-500">
              {search
                ? <>No pets match <span className="font-medium">"{search}"</span></>
                : 'No pets match the selected filter.'
              }
            </p>
            {(search || speciesFilter !== 'all') && (
              <button
                onClick={() => { setSearch(''); setSpeciesFilter('all') }}
                className="text-xs text-slate-400 hover:text-slate-600 mt-1.5 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map(pet => <PetRow key={pet.id} pet={pet} />)}
          </ul>
        )}
      </Card>

      <PetModal
        open={modalOpen}
        initialPet={null}
        owners={owners}
        allSpecies={allSpecies}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
