import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, ShieldAlert, Syringe } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card, Button, Input, Modal, EmptyState } from '@/components/ui'

// ─── Types ─────────────────────────────────────────────────────────────────────

type VaccType = {
  id:          string
  name:        string
  species_id:  string | null
  is_critical: boolean
  sort_order:  number
  is_active:   boolean
}

type SpeciesRow = { id: string; name: string; icon: string | null }

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS: { name: string; species: string; is_critical: boolean }[] = [
  { name: 'Distemper',        species: 'Dog', is_critical: true  },
  { name: 'Hepatitis',        species: 'Dog', is_critical: true  },
  { name: 'Parvovirus',       species: 'Dog', is_critical: true  },
  { name: 'Leptospirosis',    species: 'Dog', is_critical: true  },
  { name: 'Kennel Cough',     species: 'Dog', is_critical: true  },
  { name: 'Cat Flu',          species: 'Cat', is_critical: true  },
  { name: 'Feline Enteritis', species: 'Cat', is_critical: true  },
  { name: 'Feline Leukaemia', species: 'Cat', is_critical: false },
]

// ─── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
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

// ─── Row ───────────────────────────────────────────────────────────────────────

function VaccTypeRow({
  vt, allSpecies, onToggleCritical, onToggleActive, onDelete, onEdit,
}: {
  vt:               VaccType
  allSpecies:       SpeciesRow[]
  onToggleCritical: (id: string, v: boolean) => void
  onToggleActive:   (id: string, v: boolean) => void
  onDelete:         (id: string) => void
  onEdit:           (vt: VaccType) => void
}) {
  const sp = allSpecies.find(s => s.id === vt.species_id)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      {/* Critical indicator dot */}
      <span
        className={['w-2 h-2 rounded-full flex-shrink-0 mt-0.5', vt.is_critical ? 'bg-rose-400' : 'bg-slate-200'].join(' ')}
        title={vt.is_critical ? 'Critical — generates warnings' : 'Recommended'}
      />

      {/* Name + species */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{vt.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {sp ? `${sp.icon ?? ''} ${sp.name}`.trim() : 'All species'}
        </p>
      </div>

      {/* Critical toggle */}
      <div className="flex items-center gap-1.5 flex-shrink-0 hidden sm:flex">
        <ShieldAlert className={['w-3.5 h-3.5', vt.is_critical ? 'text-rose-400' : 'text-slate-200'].join(' ')} />
        <span className="text-xs text-slate-400 w-14">
          {vt.is_critical ? 'Critical' : 'Optional'}
        </span>
        <Toggle checked={vt.is_critical} onChange={v => onToggleCritical(vt.id, v)} />
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-xs text-slate-400 hidden sm:inline">Active</span>
        <Toggle checked={vt.is_active} onChange={v => onToggleActive(vt.id, v)} />
      </div>

      {/* Edit */}
      {!confirmDelete && (
        <button
          onClick={() => onEdit(vt)}
          className="p-1.5 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Delete */}
      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-500">Remove?</span>
          <button onClick={() => { onDelete(vt.id); setConfirmDelete(false) }}
            className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors">
            Yes
          </button>
          <button onClick={() => setConfirmDelete(false)}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
            Cancel
          </button>
        </div>
      )}
    </li>
  )
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

type VaccTypeForm = { name: string; species_id: string; is_critical: boolean }
const BLANK: VaccTypeForm = { name: '', species_id: '', is_critical: false }

function VaccTypeModal({
  open, existing, allSpecies, existingNames, onClose, onSave,
}: {
  open:          boolean
  existing:      VaccType | null
  allSpecies:    SpeciesRow[]
  existingNames: string[]
  onClose:       () => void
  onSave:        (form: VaccTypeForm) => Promise<void>
}) {
  const isEdit = existing !== null
  const [form,        setForm]        = useState<VaccTypeForm>(BLANK)
  const [nameError,   setNameError]   = useState<string | undefined>()
  const [saving,      setSaving]      = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm({ name: existing.name, species_id: existing.species_id ?? '', is_critical: existing.is_critical })
    } else {
      setForm(BLANK)
    }
    setNameError(undefined); setServerError(null)
  }, [open, existing])

  function validate() {
    if (!form.name.trim()) { setNameError('Name is required'); return false }
    const lower = form.name.trim().toLowerCase()
    const duplicate = existingNames.some(n => n.toLowerCase() === lower && (!existing || n.toLowerCase() !== existing.name.toLowerCase()))
    if (duplicate) { setNameError('A vaccination type with this name already exists'); return false }
    setNameError(undefined)
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true); setServerError(null)
    try {
      await onSave({ ...form, name: form.name.trim() })
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEdit ? 'Edit vaccination type' : 'Add vaccination type'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="vacc-type-form" type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Add type'}
          </Button>
        </>
      }
    >
      <form id="vacc-type-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{serverError}</div>
        )}

        <Input
          id="vt-name" label="Name" required
          value={form.name}
          onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setNameError(undefined) }}
          error={nameError}
          placeholder="e.g. Kennel Cough"
          autoComplete="off"
        />

        <div className="space-y-1.5">
          <label htmlFor="vt-species" className="block text-sm font-medium text-slate-700">
            Species <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            id="vt-species"
            value={form.species_id}
            onChange={e => setForm(p => ({ ...p, species_id: e.target.value }))}
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">All species</option>
            {allSpecies.map(s => (
              <option key={s.id} value={s.id}>{s.icon ? `${s.icon} ` : ''}{s.name}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={form.is_critical}
            onChange={e => setForm(p => ({ ...p, is_critical: e.target.checked }))}
            className="w-4 h-4 rounded border-slate-300 accent-rose-500"
          />
          <div>
            <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Critical vaccination
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Missing or expired critical vaccinations generate warnings on bookings and the calendar.
            </p>
          </div>
        </label>
      </form>
    </Modal>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function VaccinationTypesPage() {
  const { business } = useBusinessContext()
  const [types,      setTypes]      = useState<VaccType[]>([])
  const [allSpecies, setAllSpecies] = useState<SpeciesRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editing,    setEditing]    = useState<VaccType | null>(null)
  const [seeding,    setSeeding]    = useState(false)

  async function load() {
    setLoading(true)
    const [typesRes, speciesRes] = await Promise.all([
      supabase
        .from('vaccination_types')
        .select('id, name, species_id, is_critical, sort_order, is_active')
        .order('sort_order')
        .order('name'),
      supabase
        .from('species')
        .select('id, name, icon')
        .eq('is_active', true)
        .order('sort_order')
        .order('name'),
    ])
    setTypes((typesRes.data ?? []) as VaccType[])
    setAllSpecies((speciesRes.data ?? []) as SpeciesRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleToggleCritical(id: string, value: boolean) {
    setTypes(prev => prev.map(t => t.id === id ? { ...t, is_critical: value } : t))
    const { error } = await supabase.from('vaccination_types').update({ is_critical: value }).eq('id', id)
    if (error) load()
  }

  async function handleToggleActive(id: string, value: boolean) {
    setTypes(prev => prev.map(t => t.id === id ? { ...t, is_active: value } : t))
    const { error } = await supabase.from('vaccination_types').update({ is_active: value }).eq('id', id)
    if (error) load()
  }

  async function handleDelete(id: string) {
    setTypes(prev => prev.filter(t => t.id !== id))
    const { error } = await supabase.from('vaccination_types').delete().eq('id', id)
    if (error) load()
  }

  async function handleSave(form: VaccTypeForm) {
    if (!business) return
    const payload = {
      business_id: business.id,
      name:        form.name,
      species_id:  form.species_id || null,
      is_critical: form.is_critical,
      sort_order:  editing ? editing.sort_order : types.length,
      is_active:   true,
    }
    if (editing) {
      const { error } = await supabase.from('vaccination_types').update(payload).eq('id', editing.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase.from('vaccination_types').insert(payload)
      if (error) throw new Error(error.message)
    }
    await load()
  }

  async function handleSeedDefaults() {
    if (!business) return
    setSeeding(true)
    const existingNames = new Set(types.map(t => t.name.toLowerCase()))
    const toInsert = DEFAULTS
      .filter(d => !existingNames.has(d.name.toLowerCase()))
      .map((d, i) => {
        const sp = allSpecies.find(s => s.name.toLowerCase() === d.species.toLowerCase())
        return {
          business_id: business.id,
          name:        d.name,
          species_id:  sp?.id ?? null,
          is_critical: d.is_critical,
          sort_order:  types.length + i,
          is_active:   true,
        }
      })
    if (toInsert.length > 0) {
      const { error } = await supabase.from('vaccination_types').insert(toInsert)
      if (error) console.error('Seed error:', error)
    }
    await load()
    setSeeding(false)
  }

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(vt: VaccType) { setEditing(vt); setModalOpen(true) }

  const existingNames = types.map(t => t.name)

  // Group by species for display
  const speciesGroups = [
    ...allSpecies.map(s => ({
      id:    s.id,
      label: `${s.icon ? s.icon + ' ' : ''}${s.name}`,
      items: types.filter(t => t.species_id === s.id),
    })),
    {
      id:    '__all',
      label: 'All species',
      items: types.filter(t => t.species_id === null),
    },
  ].filter(g => g.items.length > 0)

  const hasDefaults = DEFAULTS.some(d => !types.find(t => t.name.toLowerCase() === d.name.toLowerCase()))

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Vaccination types"
        description="Define which vaccinations are required, and flag critical ones that generate booking warnings"
        backHref="/settings"
        action={
          <div className="flex items-center gap-2">
            {hasDefaults && (
              <Button
                variant="secondary"
                onClick={handleSeedDefaults}
                loading={seeding}
              >
                Add defaults
              </Button>
            )}
            <Button icon={<Plus className="w-4 h-4" />} onClick={openAdd}>
              Add type
            </Button>
          </div>
        }
      />

      {loading ? (
        <Card><p className="text-sm text-slate-400 py-4 text-center">Loading…</p></Card>
      ) : types.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Syringe className="w-5 h-5" />}
            title="No vaccination types yet"
            description="Add vaccination types, or click 'Add defaults' to populate the standard dog and cat vaccinations."
            action={
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleSeedDefaults} loading={seeding}>
                  Add defaults
                </Button>
                <Button icon={<Plus className="w-4 h-4" />} onClick={openAdd}>
                  Add type
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center gap-4 px-1">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
              Critical — generates warnings
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />
              Recommended only
            </span>
          </div>

          {speciesGroups.map(group => (
            <Card key={group.id} padding="none">
              <div className="px-5 pt-3.5 pb-1.5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {group.label}
                </h3>
              </div>
              <ul className="divide-y divide-slate-100">
                {group.items.map(vt => (
                  <VaccTypeRow
                    key={vt.id}
                    vt={vt}
                    allSpecies={allSpecies}
                    onToggleCritical={handleToggleCritical}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    onEdit={openEdit}
                  />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <VaccTypeModal
        open={modalOpen}
        existing={editing}
        allSpecies={allSpecies}
        existingNames={existingNames}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
