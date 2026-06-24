import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Plus, Pencil, Trash2, LayoutGrid, CopyPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card, Button, Input, Select, Textarea, Modal, EmptyState, PlanGate } from '@/components/ui'
import { usePlan } from '@/lib/plans'
import type { Database } from '@/types/database'

type PetSize      = Database['public']['Enums']['pet_size']
type SpaceTypeRow = Database['public']['Tables']['accommodation_space_types']['Row']
type AreaRow      = Database['public']['Tables']['accommodation_areas']['Row']
type Species      = Database['public']['Tables']['species']['Row']

type AreaWithSpecies = AreaRow & { speciesIds: string[] }

type SpaceSpeciesRow = {
  species_id: string
  species: Pick<Species, 'id' | 'name' | 'plural_name' | 'icon' | 'colour'> | null
}

type Space = Database['public']['Tables']['accommodation_spaces']['Row'] & {
  area:       Pick<AreaRow, 'id' | 'name'> | null
  space_type: Pick<SpaceTypeRow, 'id' | 'name'> | null
  accommodation_space_species: SpaceSpeciesRow[]
}

interface SpaceForm {
  name:                  string
  areaId:                string
  spaceTypeId:           string
  speciesIds:            string[]
  allowedSizes:          PetSize[]
  maxPets:               number
  sameHouseholdOnly:     boolean
  requiresStaffApproval: boolean
  notes:                 string
  isActive:              boolean
}

const EMPTY_FORM: SpaceForm = {
  name: '', areaId: '', spaceTypeId: '', speciesIds: [],
  allowedSizes: [], maxPets: 1, sameHouseholdOnly: true,
  requiresStaffApproval: false, notes: '', isActive: true,
}

const SIZE_OPTIONS: { value: PetSize; label: string }[] = [
  { value: 'toy',    label: 'Toy'    },
  { value: 'small',  label: 'Small'  },
  { value: 'medium', label: 'Medium' },
  { value: 'large',  label: 'Large'  },
  { value: 'giant',  label: 'Giant'  },
]

// ─── Sub-navigation ────────────────────────────────────────────────────────

export function AccommodationTabs() {
  const tabs = [
    { to: '/settings/accommodation',        label: 'Areas',            end: true  },
    { to: '/settings/accommodation/spaces', label: 'Bookable spaces',  end: false },
  ]
  return (
    <div className="flex mb-5 border-b border-slate-200 -mt-2">
      {tabs.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
          style={({ isActive }) => ({
            borderColor: isActive ? 'var(--brand-primary)' : 'transparent',
            color:       isActive ? 'var(--brand-primary)' : '#64748b',
          })}
        >
          {label}
        </NavLink>
      ))}
    </div>
  )
}

// ─── Toggle ────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      ].join(' ')}
      style={{ backgroundColor: checked ? 'var(--brand-primary)' : '#cbd5e1' }}
    >
      <span className={[
        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5',
      ].join(' ')} />
    </button>
  )
}

// ─── Species chip ──────────────────────────────────────────────────────────

function SpeciesChip({ s }: { s: Pick<Species, 'name' | 'icon' | 'colour'> }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: s.colour ? `${s.colour}18` : '#f1f5f9',
        borderColor:     s.colour ? `${s.colour}40` : '#e2e8f0',
        color:           s.colour ?? '#64748b',
      }}
    >
      {s.icon && <span className="text-sm leading-none">{s.icon}</span>}
      {s.name}
    </span>
  )
}

// ─── Space types section ───────────────────────────────────────────────────

function SpaceTypesSection({
  types,
  onAdd,
  onDelete,
}: {
  types:    SpaceTypeRow[]
  onAdd:    (name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [showAdd,   setShowAdd]   = useState(false)
  const [newName,   setNewName]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function submit() {
    if (!newName.trim()) return
    setSaving(true)
    await onAdd(newName.trim())
    setNewName('')
    setShowAdd(false)
    setSaving(false)
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Space types</h3>
          <p className="text-xs text-slate-400 mt-0.5">e.g. Kennel, Cat cabin, Cat suite, Hutch</p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add type
          </button>
        )}
      </div>

      <Card padding="none">
        {types.length === 0 && !showAdd && (
          <p className="px-4 py-3 text-sm text-slate-400 italic">
            No space types yet — optional, but useful for filtering and reports.
          </p>
        )}

        {types.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {types.map(t => (
              <li key={t.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-slate-800">{t.name}</span>
                {confirmId === t.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Remove?</span>
                    <button
                      onClick={async () => { await onDelete(t.id); setConfirmId(null) }}
                      className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                    >Yes</button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                    >Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(t.id)}
                    className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    aria-label={`Delete ${t.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {showAdd && (
          <div className={[
            'flex items-center gap-2 px-4 py-3',
            types.length > 0 ? 'border-t border-slate-100' : '',
          ].join(' ')}>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); submit() }
                if (e.key === 'Escape') { setShowAdd(false); setNewName('') }
              }}
              placeholder="Type name…"
              className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <button
              onClick={submit}
              disabled={saving || !newName.trim()}
              className="btn-brand text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName('') }}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Space row ─────────────────────────────────────────────────────────────

function SpaceRow({
  space,
  onToggle,
  onEdit,
  onDelete,
}: {
  space:    Space
  onToggle: (id: string, active: boolean) => Promise<void>
  onEdit:   (space: Space) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toggling,      setToggling]      = useState(false)

  const speciesList = space.accommodation_space_species
    .map(r => r.species)
    .filter(Boolean) as Pick<Species, 'id' | 'name' | 'plural_name' | 'icon' | 'colour'>[]

  const sizeLabel = space.allowed_pet_sizes && space.allowed_pet_sizes.length > 0
    ? space.allowed_pet_sizes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
    : 'All sizes'

  async function handleToggle(v: boolean) {
    setToggling(true)
    await onToggle(space.id, v)
    setToggling(false)
  }

  return (
    <li className={['flex items-start gap-3 px-4 py-3', !space.is_active ? 'opacity-50' : ''].join(' ')}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900">{space.name}</p>
          {space.space_type && (
            <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
              {space.space_type.name}
            </span>
          )}
          {!space.is_active && (
            <span className="text-xs bg-slate-100 text-slate-400 rounded-full px-2 py-0.5">Inactive</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {speciesList.map(s => <SpeciesChip key={s.id} s={s} />)}
          <span className="text-xs bg-slate-50 text-slate-500 rounded px-1.5 py-0.5 border border-slate-200">
            {sizeLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-slate-500">
          <span>Max {space.max_pets} {space.max_pets === 1 ? 'pet' : 'pets'}</span>
          {space.same_household_only && <span>Same household only</span>}
          {space.requires_staff_approval && (
            <span className="text-amber-600 font-medium">Staff approval required</span>
          )}
        </div>

        {space.notes && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic">{space.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <Toggle checked={space.is_active} onChange={handleToggle} disabled={toggling} />

        {!confirmDelete && (
          <>
            <button
              onClick={() => onEdit(space)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label={`Edit ${space.name}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              aria-label={`Delete ${space.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}

        {confirmDelete && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Remove?</span>
            <button
              onClick={() => { onDelete(space.id); setConfirmDelete(false) }}
              className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
            >Yes</button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >Cancel</button>
          </div>
        )}
      </div>
    </li>
  )
}

// ─── Space modal ───────────────────────────────────────────────────────────

interface SpaceModalErrors {
  name?:       string
  areaId?:     string
  speciesIds?: string
}

function SpaceModal({
  open,
  initialSpace,
  areas,
  spaceTypes,
  allSpecies,
  onClose,
  onSave,
}: {
  open:         boolean
  initialSpace: Space | null
  areas:        AreaWithSpecies[]
  spaceTypes:   SpaceTypeRow[]
  allSpecies:   Species[]
  onClose:      () => void
  onSave:       (form: SpaceForm, id: string | null) => Promise<void>
}) {
  const isEdit = initialSpace !== null

  const [form,        setForm]        = useState<SpaceForm>(EMPTY_FORM)
  const [errors,      setErrors]      = useState<SpaceModalErrors>({})
  const [saving,      setSaving]      = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (initialSpace) {
      setForm({
        name:                  initialSpace.name,
        areaId:                initialSpace.area_id,
        spaceTypeId:           initialSpace.space_type_id ?? '',
        speciesIds:            initialSpace.accommodation_space_species.map(r => r.species_id),
        allowedSizes:          initialSpace.allowed_pet_sizes ?? [],
        maxPets:               initialSpace.max_pets,
        sameHouseholdOnly:     initialSpace.same_household_only,
        requiresStaffApproval: initialSpace.requires_staff_approval,
        notes:                 initialSpace.notes ?? '',
        isActive:              initialSpace.is_active,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
    setServerError(null)
  }, [open, initialSpace])

  function set<K extends keyof SpaceForm>(k: K, v: SpaceForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    if (k === 'name' && errors.name)             setErrors(prev => ({ ...prev, name: undefined }))
    if (k === 'areaId' && errors.areaId)         setErrors(prev => ({ ...prev, areaId: undefined }))
    if (k === 'speciesIds' && errors.speciesIds) setErrors(prev => ({ ...prev, speciesIds: undefined }))
  }

  function setArea(id: string) {
    const newArea = areas.find(a => a.id === id)
    const restricted = newArea && newArea.speciesIds.length > 0
    const allowed = restricted ? new Set(newArea!.speciesIds) : null
    const kept = allowed ? form.speciesIds.filter(sid => allowed.has(sid)) : form.speciesIds
    setForm(prev => ({ ...prev, areaId: id, speciesIds: kept }))
    if (errors.areaId) { setErrors(prev => ({ ...prev, areaId: undefined })) }
  }

  function toggleSpecies(id: string) {
    const next = form.speciesIds.includes(id)
      ? form.speciesIds.filter(s => s !== id)
      : [...form.speciesIds, id]
    set('speciesIds', next)
  }

  function toggleSize(size: PetSize) {
    const next = form.allowedSizes.includes(size)
      ? form.allowedSizes.filter(s => s !== size)
      : [...form.allowedSizes, size]
    set('allowedSizes', next)
  }

  function validate() {
    const errs: SpaceModalErrors = {}
    if (!form.name.trim())          errs.name      = 'Space name is required.'
    if (!form.areaId)               errs.areaId    = 'Please select an area.'
    if (form.speciesIds.length === 0) errs.speciesIds = 'At least one allowed species is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setServerError(null)
    try {
      await onSave(form, initialSpace?.id ?? null)
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const activeSpecies = allSpecies.filter(s => s.is_active)
  const activeAreas   = areas.filter(a => a.is_active)

  // If editing and the current area is inactive, still show it so the select isn't blank
  const editingInactiveArea = isEdit && initialSpace
    ? areas.find(a => a.id === initialSpace.area_id && !a.is_active)
    : null

  // Filter species to those permitted by the selected area (if the area has a restriction)
  const selectedArea = areas.find(a => a.id === form.areaId)
  const areaRestricted = selectedArea && selectedArea.speciesIds.length > 0
  const permittedSpecies = areaRestricted
    ? activeSpecies.filter(s => selectedArea!.speciesIds.includes(s.id))
    : activeSpecies

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit bookable space' : 'Add bookable space'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="space-form" type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Add space'}
          </Button>
        </>
      }
    >
      <form id="space-form" onSubmit={handleSubmit} className="space-y-5" noValidate>

        {/* ── Basic details ───────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Basic details</p>

          <Input
            id="space-name"
            label="Space name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            error={errors.name}
            placeholder="e.g. Kennel 1, Cat Suite 3, Small Animal Room A"
            required
            autoComplete="off"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              id="space-area"
              label="Area"
              value={form.areaId}
              onChange={e => setArea(e.target.value)}
              error={errors.areaId}
              required
            >
              <option value="">— Select area —</option>
              {activeAreas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
              {editingInactiveArea && (
                <option value={editingInactiveArea.id}>{editingInactiveArea.name} (inactive)</option>
              )}
            </Select>

            <Select
              id="space-type"
              label="Space type"
              value={form.spaceTypeId}
              onChange={e => set('spaceTypeId', e.target.value)}
            >
              <option value="">— None —</option>
              {spaceTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Permitted animals ───────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Permitted animals</p>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Allowed species
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>

            {areaRestricted && (
              <p className="text-xs text-slate-500 -mt-1">
                Restricted to the species allowed in this area.
              </p>
            )}
            {permittedSpecies.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                {form.areaId ? 'No species are configured for this area.' : 'No active species configured.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {permittedSpecies.map(s => {
                  const selected = form.speciesIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSpecies(s.id)}
                      className={[
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all',
                        selected
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white',
                      ].join(' ')}
                      style={selected ? {
                        backgroundColor: s.colour ?? 'var(--brand-primary)',
                        borderColor:     s.colour ?? 'var(--brand-primary)',
                      } : {}}
                    >
                      {s.icon && <span>{s.icon}</span>}
                      {s.name}
                    </button>
                  )
                })}
              </div>
            )}


            {errors.speciesIds && (
              <p className="text-xs text-red-600" role="alert">{errors.speciesIds}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Size categories
              <span className="text-slate-400 font-normal ml-1.5 text-xs">
                — leave all unchecked to allow all sizes
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SIZE_OPTIONS.map(({ value, label }) => {
                const selected = form.allowedSizes.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleSize(value)}
                    className={[
                      'px-3 py-1.5 rounded-full text-sm border transition-all',
                      selected
                        ? 'bg-slate-700 border-slate-700 text-white shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {form.allowedSizes.length > 0 && (
              <p className="text-xs text-slate-500">
                Only {form.allowedSizes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')} will be permitted.
              </p>
            )}
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Booking rules ───────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Booking rules</p>

          <div className="w-36">
            <Input
              id="space-max-pets"
              label="Max pets"
              type="number"
              min={1}
              value={form.maxPets}
              onChange={e => set('maxPets', Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Same household only</p>
              <p className="text-xs text-slate-500">Only pets from the same booking can share this space</p>
            </div>
            <Toggle
              checked={form.sameHouseholdOnly}
              onChange={v => set('sameHouseholdOnly', v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Staff approval required</p>
              <p className="text-xs text-slate-500">A staff member must confirm this space before the booking is finalised</p>
            </div>
            <Toggle
              checked={form.requiresStaffApproval}
              onChange={v => set('requiresStaffApproval', v)}
            />
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Notes ──────────────────────────────────── */}
        <Textarea
          id="space-notes"
          label="Notes"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={2}
          placeholder="Optional internal notes about this space…"
        />

        {/* ── Active (edit only) ─────────────────────── */}
        {isEdit && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Active</p>
              <p className="text-xs text-slate-500">Inactive spaces are hidden from booking workflows</p>
            </div>
            <Toggle checked={form.isActive} onChange={v => set('isActive', v)} />
          </div>
        )}

        {serverError && (
          <p className="text-sm text-red-600" role="alert">{serverError}</p>
        )}
      </form>
    </Modal>
  )
}

// ─── Bulk create modal ─────────────────────────────────────────────────────

interface BulkForm {
  areaId:            string
  prefix:            string
  startNumber:       number
  count:             number
  spaceTypeId:       string
  speciesIds:        string[]
  allowedSizes:      PetSize[]
  maxPets:           number
  sameHouseholdOnly: boolean
}

const EMPTY_BULK: BulkForm = {
  areaId: '', prefix: '', startNumber: 1, count: 5,
  spaceTypeId: '', speciesIds: [], allowedSizes: [], maxPets: 1,
  sameHouseholdOnly: true,
}

interface BulkFormErrors {
  areaId?:     string
  prefix?:     string
  count?:      string
  speciesIds?: string
}

function BulkCreateModal({
  open,
  areas,
  spaceTypes,
  allSpecies,
  onClose,
  onSave,
}: {
  open:       boolean
  areas:      AreaWithSpecies[]
  spaceTypes: SpaceTypeRow[]
  allSpecies: Species[]
  onClose:    () => void
  onSave:     (form: BulkForm) => Promise<void>
}) {
  const [form,        setFormState] = useState<BulkForm>(EMPTY_BULK)
  const [errors,      setErrors]    = useState<BulkFormErrors>({})
  const [saving,      setSaving]    = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFormState(EMPTY_BULK)
      setErrors({})
      setServerError(null)
    }
  }, [open])

  function set<K extends keyof BulkForm>(k: K, v: BulkForm[K]) {
    setFormState(prev => ({ ...prev, [k]: v }))
  }

  function setArea(id: string) {
    const newArea = areas.find(a => a.id === id)
    const restricted = newArea && newArea.speciesIds.length > 0
    const allowed = restricted ? new Set(newArea!.speciesIds) : null
    const kept = allowed ? form.speciesIds.filter(sid => allowed.has(sid)) : form.speciesIds
    setFormState(prev => ({ ...prev, areaId: id, speciesIds: kept }))
    if (errors.areaId) { setErrors(prev => ({ ...prev, areaId: undefined })) }
  }

  function toggleSpecies(id: string) {
    const next = form.speciesIds.includes(id)
      ? form.speciesIds.filter(s => s !== id)
      : [...form.speciesIds, id]
    set('speciesIds', next)
    if (errors.speciesIds) { setErrors(prev => ({ ...prev, speciesIds: undefined })) }
  }

  function toggleSize(size: PetSize) {
    const next = form.allowedSizes.includes(size)
      ? form.allowedSizes.filter(s => s !== size)
      : [...form.allowedSizes, size]
    set('allowedSizes', next)
  }

  function validate() {
    const errs: BulkFormErrors = {}
    if (!form.areaId)               errs.areaId     = 'Please select an area.'
    if (!form.prefix.trim())        errs.prefix     = 'A name prefix is required.'
    if (form.count < 1 || form.count > 100) errs.count = 'Count must be between 1 and 100.'
    if (form.speciesIds.length === 0) errs.speciesIds = 'At least one species is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setServerError(null)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const activeSpecies = allSpecies.filter(s => s.is_active)
  const activeAreas   = areas.filter(a => a.is_active)
  const selectedArea  = areas.find(a => a.id === form.areaId)
  const areaRestricted = selectedArea && selectedArea.speciesIds.length > 0
  const permittedSpecies = areaRestricted
    ? activeSpecies.filter(s => selectedArea!.speciesIds.includes(s.id))
    : activeSpecies

  const preview = form.prefix.trim() && form.count >= 1
    ? `${form.prefix.trim()} ${form.startNumber} … ${form.prefix.trim()} ${form.startNumber + form.count - 1}`
    : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create multiple spaces"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="bulk-form" type="submit" loading={saving}>
            Create {form.count > 0 ? form.count : ''} space{form.count !== 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <form id="bulk-form" onSubmit={handleSubmit} className="space-y-5" noValidate>

        {/* ── Naming ─────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Naming</p>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input
                id="bulk-prefix"
                label="Name prefix"
                value={form.prefix}
                onChange={e => set('prefix', e.target.value)}
                error={errors.prefix}
                placeholder="e.g. Kennel, Cat Suite"
                required
                autoComplete="off"
              />
            </div>
            <Input
              id="bulk-start"
              label="Start at"
              type="number"
              min={0}
              value={form.startNumber}
              onChange={e => set('startNumber', parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 items-end">
            <Input
              id="bulk-count"
              label="How many"
              type="number"
              min={1}
              max={100}
              value={form.count}
              onChange={e => set('count', parseInt(e.target.value) || 1)}
              error={errors.count}
              required
            />
            {preview && (
              <div className="col-span-2 pb-1">
                <p className="text-xs text-slate-500">
                  Will create: <span className="font-medium text-slate-700">{preview}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Location & type ────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Location & type</p>

          <div className="grid grid-cols-2 gap-4">
            <Select
              id="bulk-area"
              label="Area"
              value={form.areaId}
              onChange={e => setArea(e.target.value)}
              error={errors.areaId}
              required
            >
              <option value="">— Select area —</option>
              {activeAreas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>

            <Select
              id="bulk-type"
              label="Space type"
              value={form.spaceTypeId}
              onChange={e => set('spaceTypeId', e.target.value)}
            >
              <option value="">— None —</option>
              {spaceTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Permitted animals ───────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Permitted animals</p>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Allowed species
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>

            {areaRestricted && (
              <p className="text-xs text-slate-500">Restricted to the species allowed in this area.</p>
            )}

            {permittedSpecies.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                {form.areaId ? 'No species are configured for this area.' : 'Select an area first.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {permittedSpecies.map(s => {
                  const selected = form.speciesIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSpecies(s.id)}
                      className={[
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all',
                        selected
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white',
                      ].join(' ')}
                      style={selected ? {
                        backgroundColor: s.colour ?? 'var(--brand-primary)',
                        borderColor:     s.colour ?? 'var(--brand-primary)',
                      } : {}}
                    >
                      {s.icon && <span>{s.icon}</span>}
                      {s.name}
                    </button>
                  )
                })}
              </div>
            )}

            {errors.speciesIds && (
              <p className="text-xs text-red-600" role="alert">{errors.speciesIds}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Size categories
              <span className="text-slate-400 font-normal ml-1.5 text-xs">
                — leave all unchecked to allow all sizes
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SIZE_OPTIONS.map(({ value, label }) => {
                const selected = form.allowedSizes.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleSize(value)}
                    className={[
                      'px-3 py-1.5 rounded-full text-sm border transition-all',
                      selected
                        ? 'bg-slate-700 border-slate-700 text-white shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Booking rules ───────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Booking rules</p>

          <div className="w-36">
            <Input
              id="bulk-max-pets"
              label="Max pets per space"
              type="number"
              min={1}
              value={form.maxPets}
              onChange={e => set('maxPets', Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Same household only</p>
              <p className="text-xs text-slate-500">Only pets from the same booking can share this space</p>
            </div>
            <Toggle
              checked={form.sameHouseholdOnly}
              onChange={v => set('sameHouseholdOnly', v)}
            />
          </div>
        </div>

        {serverError && (
          <p className="text-sm text-red-600" role="alert">{serverError}</p>
        )}
      </form>
    </Modal>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function BookableSpacesPage() {
  const { business } = useBusinessContext()
  const { within } = usePlan()

  const [spaces,        setSpaces]        = useState<Space[]>([])
  const [areas,         setAreas]         = useState<AreaWithSpecies[]>([])
  const [spaceTypes,    setSpaceTypes]    = useState<SpaceTypeRow[]>([])
  const [allSpecies,    setAllSpecies]    = useState<Species[]>([])
  const [loading,       setLoading]       = useState(true)
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editingSpace,  setEditingSpace]  = useState<Space | null>(null)
  const [bulkOpen,      setBulkOpen]      = useState(false)

  const canAddSpace = within('maxSpaces', spaces.length)

  async function load() {
    setLoading(true)
    const [spacesRes, areasRes, typesRes, speciesRes] = await Promise.all([
      supabase
        .from('accommodation_spaces')
        .select(`
          *,
          area:area_id ( id, name ),
          space_type:space_type_id ( id, name ),
          accommodation_space_species (
            species_id,
            species:species_id ( id, name, plural_name, icon, colour )
          )
        `)
        .order('sort_order')
        .order('name'),
      supabase
        .from('accommodation_areas')
        .select('*, accommodation_area_species ( species_id )')
        .order('sort_order')
        .order('name'),
      supabase
        .from('accommodation_space_types')
        .select('*')
        .order('name'),
      supabase
        .from('species')
        .select('*')
        .order('is_system_default', { ascending: false })
        .order('sort_order')
        .order('name'),
    ])
    setSpaces((spacesRes.data ?? []) as Space[])
    setAreas((areasRes.data ?? []).map(a => ({
      ...a,
      speciesIds: (a.accommodation_area_species as { species_id: string }[] | undefined ?? []).map(r => r.species_id),
    })))
    setSpaceTypes(typesRes.data ?? [])
    setAllSpecies(speciesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd()          { setEditingSpace(null); setModalOpen(true) }
  function openEdit(s: Space) { setEditingSpace(s);    setModalOpen(true) }

  async function handleBulkSave(form: BulkForm) {
    const spacesToCreate = Array.from({ length: form.count }, (_, i) => ({
      business_id:             business!.id,
      name:                    `${form.prefix.trim()} ${form.startNumber + i}`,
      area_id:                 form.areaId,
      space_type_id:           form.spaceTypeId || null,
      allowed_pet_sizes:       form.allowedSizes.length > 0 ? form.allowedSizes : null,
      max_pets:                form.maxPets,
      same_household_only:     form.sameHouseholdOnly,
      requires_staff_approval: false,
      is_active:               true,
      sort_order:              spaces.length + i,
    }))
    const { data: created, error } = await supabase
      .from('accommodation_spaces')
      .insert(spacesToCreate)
      .select('id')
    if (error) throw new Error(error.message)

    if (form.speciesIds.length > 0 && created) {
      const speciesLinks = created.flatMap(space =>
        form.speciesIds.map(species_id => ({
          space_id:    space.id,
          species_id,
          business_id: business!.id,
        }))
      )
      const { error: sErr } = await supabase
        .from('accommodation_space_species')
        .insert(speciesLinks)
      if (sErr) throw new Error(sErr.message)
    }

    await load()
  }

  async function handleToggle(id: string, active: boolean) {
    setSpaces(prev => prev.map(s => s.id === id ? { ...s, is_active: active } : s))
    const { error } = await supabase
      .from('accommodation_spaces')
      .update({ is_active: active })
      .eq('id', id)
    if (error) {
      setSpaces(prev => prev.map(s => s.id === id ? { ...s, is_active: !active } : s))
    } else {
      const spaceName = spaces.find(s => s.id === id)?.name ?? null
      await logAudit(business!.id, {
        action:      'space.updated',
        entity_type: 'space',
        entity_id:   id,
        after: { name: spaceName, is_active: active },
      })
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('accommodation_spaces').delete().eq('id', id)
    if (error) { alert(error.message); return }
    setSpaces(prev => prev.filter(s => s.id !== id))
  }

  async function handleAddSpaceType(name: string) {
    const { data, error } = await supabase
      .from('accommodation_space_types')
      .insert({ business_id: business!.id, name })
      .select()
      .single()
    if (!error && data) setSpaceTypes(prev => [...prev, data])
  }

  async function handleDeleteSpaceType(id: string) {
    const { error } = await supabase.from('accommodation_space_types').delete().eq('id', id)
    if (error) {
      const msg = error.code === '23503'
        ? 'This space type is used by one or more spaces. Remove it from all spaces first.'
        : error.message
      alert(msg)
    } else {
      setSpaceTypes(prev => prev.filter(t => t.id !== id))
    }
  }

  async function handleSave(form: SpaceForm, id: string | null) {
    if (id) {
      const { error } = await supabase
        .from('accommodation_spaces')
        .update({
          name:                    form.name.trim(),
          area_id:                 form.areaId,
          space_type_id:           form.spaceTypeId || null,
          allowed_pet_sizes:       form.allowedSizes.length > 0 ? form.allowedSizes : null,
          max_pets:                form.maxPets,
          same_household_only:     form.sameHouseholdOnly,
          requires_staff_approval: form.requiresStaffApproval,
          notes:                   form.notes.trim() || null,
          is_active:               form.isActive,
        })
        .eq('id', id)
      if (error) throw new Error(error.message)

      await supabase.from('accommodation_space_species').delete().eq('space_id', id)
      if (form.speciesIds.length > 0) {
        const { error: sErr } = await supabase
          .from('accommodation_space_species')
          .insert(form.speciesIds.map(sid => ({
            space_id:    id,
            species_id:  sid,
            business_id: business!.id,
          })))
        if (sErr) throw new Error(sErr.message)
      }
      await logAudit(business!.id, {
        action:      'space.updated',
        entity_type: 'space',
        entity_id:   id,
        after: { name: form.name.trim(), is_active: form.isActive },
      })
    } else {
      const { data: newSpace, error } = await supabase
        .from('accommodation_spaces')
        .insert({
          business_id:             business!.id,
          name:                    form.name.trim(),
          area_id:                 form.areaId,
          space_type_id:           form.spaceTypeId || null,
          allowed_pet_sizes:       form.allowedSizes.length > 0 ? form.allowedSizes : null,
          max_pets:                form.maxPets,
          same_household_only:     form.sameHouseholdOnly,
          requires_staff_approval: form.requiresStaffApproval,
          notes:                   form.notes.trim() || null,
          is_active:               true,
          sort_order:              spaces.length,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)

      if (form.speciesIds.length > 0) {
        const { error: sErr } = await supabase
          .from('accommodation_space_species')
          .insert(form.speciesIds.map(sid => ({
            space_id:    newSpace.id,
            species_id:  sid,
            business_id: business!.id,
          })))
        if (sErr) throw new Error(sErr.message)
      }
      await logAudit(business!.id, {
        action:      'space.created',
        entity_type: 'space',
        entity_id:   newSpace.id,
        after: { name: form.name.trim(), is_active: true },
      })
    }

    await load()
  }

  // Group spaces by area
  const spaceGroups = areas
    .map(area => ({ area, spaces: spaces.filter(s => s.area_id === area.id) }))
    .filter(g => g.spaces.length > 0)

  // Spaces whose area has been deleted (shouldn't happen with FK RESTRICT but defensive)
  const orphanedSpaces = spaces.filter(s => !areas.find(a => a.id === s.area_id))

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Bookable spaces"
        description="Physical spaces available for pet boarding — kennels, catteries, hutches and enclosures"
        backHref="/settings"
        action={
          canAddSpace ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                icon={<CopyPlus className="w-4 h-4" />}
                onClick={() => setBulkOpen(true)}
              >
                Create multiple
              </Button>
              <Button icon={<Plus className="w-4 h-4" />} onClick={openAdd}>
                Add space
              </Button>
            </div>
          ) : undefined
        }
      />

      <AccommodationTabs />

      {!canAddSpace && (
        <PlanGate
          feature="More bookable spaces"
          requiredPlan="PawBoard Professional"
          limitHit
          className="mb-4"
        />
      )}

      <SpaceTypesSection
        types={spaceTypes}
        onAdd={handleAddSpaceType}
        onDelete={handleDeleteSpaceType}
      />

      <Card padding="none">
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-400 text-center">Loading…</div>
        ) : spaces.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="w-5 h-5" />}
            title="No bookable spaces yet"
            description="Add your kennels, catteries, hutches or enclosures. Each space belongs to an area and must allow at least one species."
            action={
              canAddSpace ? (
                <Button variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={openAdd}>
                  Add space
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div>
            {spaceGroups.map(({ area, spaces: areaSpaces }, idx) => (
              <div key={area.id} className={idx > 0 ? 'border-t-2 border-slate-100' : ''}>
                <div className="px-4 pt-3 pb-1 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {area.name}
                  </p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {areaSpaces.map(space => (
                    <SpaceRow
                      key={space.id}
                      space={space}
                      onToggle={handleToggle}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </ul>
              </div>
            ))}
            {orphanedSpaces.length > 0 && (
              <div className="border-t-2 border-slate-100">
                <div className="px-4 pt-3 pb-1 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    No area assigned
                  </p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {orphanedSpaces.map(space => (
                    <SpaceRow
                      key={space.id}
                      space={space}
                      onToggle={handleToggle}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      <SpaceModal
        open={modalOpen}
        initialSpace={editingSpace}
        areas={areas}
        spaceTypes={spaceTypes}
        allSpecies={allSpecies}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <BulkCreateModal
        open={bulkOpen}
        areas={areas}
        spaceTypes={spaceTypes}
        allSpecies={allSpecies}
        onClose={() => setBulkOpen(false)}
        onSave={handleBulkSave}
      />
    </div>
  )
}
