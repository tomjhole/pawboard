import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card, Button, Input, Textarea, Modal, EmptyState, PlanGate } from '@/components/ui'
import { AccommodationTabs } from '@/pages/settings/BookableSpacesPage'
import { usePlan } from '@/lib/plans'
import type { Database } from '@/types/database'

type Area    = Database['public']['Tables']['accommodation_areas']['Row']
type Species = Database['public']['Tables']['species']['Row']

// Flattened shape returned by the join query
type AreaSpeciesRow = {
  species_id: string
  species: Pick<Species, 'id' | 'name' | 'plural_name' | 'icon' | 'colour'> | null
}
type AreaWithSpecies = Area & { accommodation_area_species: AreaSpeciesRow[] }

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

// ─── Area row ──────────────────────────────────────────────────────────────

function AreaRow({
  area,
  onToggle,
  onEdit,
  onDelete,
}: {
  area: AreaWithSpecies
  onToggle: (id: string, active: boolean) => void
  onEdit: (area: AreaWithSpecies) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toggling, setToggling]           = useState(false)
  const speciesList = area.accommodation_area_species
    .map(r => r.species)
    .filter(Boolean) as Pick<Species, 'id' | 'name' | 'plural_name' | 'icon' | 'colour'>[]

  async function handleToggle(v: boolean) {
    setToggling(true)
    await onToggle(area.id, v)
    setToggling(false)
  }

  return (
    <li className={['flex items-start gap-4 px-5 py-4', !area.is_active ? 'opacity-50' : ''].join(' ')}>
      {/* Icon band */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white mt-0.5"
        style={{ backgroundColor: 'var(--brand-primary)' }}
      >
        <Building2 className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900">{area.name}</p>
          {!area.is_active && (
            <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Inactive</span>
          )}
        </div>
        {area.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{area.description}</p>
        )}
        {speciesList.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {speciesList.map(s => <SpeciesChip key={s.id} s={s} />)}
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-1.5 italic">No species restriction set</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <Toggle checked={area.is_active} onChange={handleToggle} disabled={toggling} />

        {!confirmDelete && (
          <>
            <button
              onClick={() => onEdit(area)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label={`Edit ${area.name}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              aria-label={`Delete ${area.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}

        {confirmDelete && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Remove?</span>
            <button
              onClick={() => { onDelete(area.id); setConfirmDelete(false) }}
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

// ─── Add / Edit modal ──────────────────────────────────────────────────────

interface AreaForm {
  name:        string
  description: string
  speciesIds:  string[]
  is_active:   boolean
}

function AreaModal({
  open,
  initialArea,
  allSpecies,
  onClose,
  onSave,
}: {
  open:        boolean
  initialArea: AreaWithSpecies | null   // null = adding new
  allSpecies:  Species[]
  onClose:     () => void
  onSave:      (form: AreaForm, id: string | null) => Promise<void>
}) {
  const isEdit = initialArea !== null

  const [form, setForm] = useState<AreaForm>({
    name: '', description: '', speciesIds: [], is_active: true,
  })
  const [errors, setErrors]       = useState<{ name?: string }>({})
  const [saving, setSaving]       = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (initialArea) {
      setForm({
        name:        initialArea.name,
        description: initialArea.description ?? '',
        speciesIds:  initialArea.accommodation_area_species.map(r => r.species_id),
        is_active:   initialArea.is_active,
      })
    } else {
      setForm({ name: '', description: '', speciesIds: [], is_active: true })
    }
    setErrors({})
    setServerError(null)
  }, [open, initialArea])

  function toggleSpecies(id: string) {
    setForm(prev => ({
      ...prev,
      speciesIds: prev.speciesIds.includes(id)
        ? prev.speciesIds.filter(s => s !== id)
        : [...prev.speciesIds, id],
    }))
  }

  function validate() {
    const errs: { name?: string } = {}
    if (!form.name.trim()) errs.name = 'Area name is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setServerError(null)
    setSaving(true)
    try {
      await onSave(form, initialArea?.id ?? null)
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const activeSpecies = allSpecies.filter(s => s.is_active)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit area' : 'Add area'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="area-form" type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Add area'}
          </Button>
        </>
      }
    >
      <form id="area-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          id="area-name"
          label="Area name"
          value={form.name}
          onChange={e => {
            setForm(prev => ({ ...prev, name: e.target.value }))
            if (errors.name) setErrors({})
          }}
          error={errors.name}
          placeholder="e.g. Dog Block A, Main Cattery, Small Animal Room"
          required
          autoComplete="off"
        />

        <Textarea
          id="area-description"
          label="Description"
          value={form.description}
          onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          rows={2}
          placeholder="Optional — location, capacity notes, any special rules…"
        />

        {/* Species multi-select */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Permitted species
            <span className="text-slate-400 font-normal ml-1">(select all that apply)</span>
          </label>

          {activeSpecies.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No active species configured.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeSpecies.map(s => {
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

          {form.speciesIds.length === 0 && (
            <p className="text-xs text-amber-600">
              No species selected — this area will have no restriction label. Consider selecting at least one.
            </p>
          )}
        </div>

        {/* Active toggle (edit only) */}
        {isEdit && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Active</p>
              <p className="text-xs text-slate-500">Inactive areas are hidden from booking workflows</p>
            </div>
            <Toggle
              checked={form.is_active}
              onChange={v => setForm(prev => ({ ...prev, is_active: v }))}
            />
          </div>
        )}

        {serverError && (
          <p className="text-sm text-red-600" role="alert">{serverError}</p>
        )}
      </form>
    </Modal>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AccommodationPage() {
  const { business } = useBusinessContext()
  const { within } = usePlan()

  const [areas, setAreas]         = useState<AreaWithSpecies[]>([])
  const [allSpecies, setAllSpecies] = useState<Species[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingArea, setEditingArea] = useState<AreaWithSpecies | null>(null)

  const canAddArea = within('maxAreas', areas.length)

  async function load() {
    setLoading(true)
    const [areasResult, speciesResult] = await Promise.all([
      supabase
        .from('accommodation_areas')
        .select(`
          *,
          accommodation_area_species (
            species_id,
            species:species_id ( id, name, plural_name, icon, colour )
          )
        `)
        .order('sort_order')
        .order('name'),
      supabase
        .from('species')
        .select('*')
        .order('is_system_default', { ascending: false })
        .order('sort_order')
        .order('name'),
    ])
    setAreas((areasResult.data ?? []) as AreaWithSpecies[])
    setAllSpecies(speciesResult.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd()  { setEditingArea(null); setModalOpen(true) }
  function openEdit(a: AreaWithSpecies) { setEditingArea(a); setModalOpen(true) }

  async function handleToggle(id: string, active: boolean) {
    setAreas(prev => prev.map(a => a.id === id ? { ...a, is_active: active } : a))
    const { error } = await supabase
      .from('accommodation_areas')
      .update({ is_active: active })
      .eq('id', id)
    if (error) setAreas(prev => prev.map(a => a.id === id ? { ...a, is_active: !active } : a))
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('accommodation_areas').delete().eq('id', id)
    if (error) {
      // FK violation means spaces exist in this area
      const msg = error.code === '23503'
        ? 'This area still has spaces. Move or delete the spaces first.'
        : error.message
      alert(msg)
      return
    }
    setAreas(prev => prev.filter(a => a.id !== id))
  }

  async function handleSave(form: AreaForm, id: string | null) {
    if (id) {
      // Update area
      const { error } = await supabase
        .from('accommodation_areas')
        .update({
          name:        form.name.trim(),
          description: form.description.trim() || null,
          is_active:   form.is_active,
        })
        .eq('id', id)
      if (error) throw new Error(error.message)

      // Replace species links
      await supabase.from('accommodation_area_species').delete().eq('area_id', id)
      if (form.speciesIds.length > 0) {
        const { error: sErr } = await supabase
          .from('accommodation_area_species')
          .insert(form.speciesIds.map(sid => ({
            area_id:    id,
            species_id: sid,
            business_id: business!.id,
          })))
        if (sErr) throw new Error(sErr.message)
      }
    } else {
      // Insert area
      const { data: newArea, error } = await supabase
        .from('accommodation_areas')
        .insert({
          business_id:  business!.id,
          name:         form.name.trim(),
          description:  form.description.trim() || null,
          is_active:    true,
          sort_order:   areas.length,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)

      // Add species links
      if (form.speciesIds.length > 0) {
        const { error: sErr } = await supabase
          .from('accommodation_area_species')
          .insert(form.speciesIds.map(sid => ({
            area_id:     newArea.id,
            species_id:  sid,
            business_id: business!.id,
          })))
        if (sErr) throw new Error(sErr.message)
      }
    }

    await load()
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Accommodation areas"
        description="Group your spaces into areas such as dog blocks, catteries and small animal rooms"
        backHref="/settings"
        action={
          canAddArea ? (
            <Button icon={<Plus className="w-4 h-4" />} onClick={openAdd}>
              Add area
            </Button>
          ) : undefined
        }
      />

      <AccommodationTabs />

      {!canAddArea && (
        <PlanGate
          feature="More accommodation areas"
          requiredPlan="PawBoard Professional"
          limitHit
          className="mb-4"
        />
      )}

      <Card padding="none">
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-400 text-center">Loading…</div>
        ) : areas.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-5 h-5" />}
            title="No accommodation areas yet"
            description="Create areas to organise your spaces — for example a dog block, a main cattery, or an isolation room."
            action={
              <Button
                variant="secondary"
                icon={<Plus className="w-4 h-4" />}
                onClick={openAdd}
              >
                Add area
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {areas.map(area => (
              <AreaRow
                key={area.id}
                area={area}
                onToggle={handleToggle}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </Card>

      <AreaModal
        open={modalOpen}
        initialArea={editingArea}
        allSpecies={allSpecies}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
