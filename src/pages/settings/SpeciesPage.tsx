import { useState, useEffect } from 'react'
import { Plus, Trash2, PawPrint } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card, Button, Input, Modal, EmptyState, PlanGate } from '@/components/ui'
import { usePlan } from '@/lib/plans'
import type { Database } from '@/types/database'

type Species = Database['public']['Tables']['species']['Row']

// ─── Suggestions ─────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { name: 'Rabbit',      plural: 'Rabbits',       icon: '🐰', colour: '#a78bfa' },
  { name: 'Guinea pig',  plural: 'Guinea pigs',   icon: '🐹', colour: '#fb923c' },
  { name: 'Hamster',     plural: 'Hamsters',      icon: '🐭', colour: '#fbbf24' },
  { name: 'Ferret',      plural: 'Ferrets',       icon: '🦡', colour: '#78716c' },
  { name: 'Bird',        plural: 'Birds',         icon: '🦜', colour: '#34d399' },
  { name: 'Reptile',     plural: 'Reptiles',      icon: '🦎', colour: '#84cc16' },
  { name: 'Other',       plural: 'Other animals', icon: '🐾', colour: '#94a3b8' },
]

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, disabled = false,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
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
      <span
        className={[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  )
}

// ─── Species row ─────────────────────────────────────────────────────────────

function SpeciesRow({
  species,
  onToggle,
  onDelete,
}: {
  species: Species
  onToggle?: (id: string, active: boolean) => void
  onDelete?: (id: string) => void
}) {
  const isSystem = species.is_system_default
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function handleToggle(active: boolean) {
    if (!onToggle) return
    setToggling(true)
    await onToggle(species.id, active)
    setToggling(false)
  }

  return (
    <li className="flex items-center gap-4 px-5 py-3.5">
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 border border-slate-100"
        style={{ backgroundColor: species.colour ? `${species.colour}20` : '#f1f5f9' }}
      >
        {species.icon ?? '🐾'}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">
          {species.name}
          <span className="text-slate-400 font-normal ml-1">/ {species.plural_name}</span>
        </p>
        {isSystem && (
          <span className="inline-block text-xs text-slate-400 mt-0.5">
            System default · cannot be removed
          </span>
        )}
      </div>

      {/* Colour swatch */}
      {species.colour && (
        <div
          className="w-4 h-4 rounded-full border border-slate-200 flex-shrink-0 hidden sm:block"
          style={{ backgroundColor: species.colour }}
          title={species.colour}
        />
      )}

      {/* Toggle / system badge */}
      {isSystem ? (
        <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 flex-shrink-0">
          Always on
        </span>
      ) : (
        <Toggle
          checked={species.is_active}
          onChange={handleToggle}
          disabled={toggling}
        />
      )}

      {/* Delete */}
      {!isSystem && !confirmDelete && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          aria-label={`Delete ${species.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* Inline delete confirmation */}
      {confirmDelete && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-500">Remove?</span>
          <button
            onClick={() => { onDelete?.(species.id); setConfirmDelete(false) }}
            className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  )
}

// ─── Add species modal ────────────────────────────────────────────────────────

interface AddForm {
  name:   string
  plural: string
  icon:   string
  colour: string
}

const BLANK: AddForm = { name: '', plural: '', icon: '', colour: '#94a3b8' }

function AddSpeciesModal({
  open,
  existingNames,
  onClose,
  onAdd,
}: {
  open: boolean
  existingNames: string[]
  onClose: () => void
  onAdd: (form: AddForm) => Promise<void>
}) {
  const [form, setForm] = useState<AddForm>(BLANK)
  const [errors, setErrors] = useState<Partial<AddForm>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) { setForm(BLANK); setErrors({}); setServerError(null) }
  }, [open])

  // Auto-suggest plural when name changes
  function handleNameChange(name: string) {
    setForm(prev => ({
      ...prev,
      name,
      plural: prev.plural === '' || prev.plural === prev.name + 's'
        ? name + 's'
        : prev.plural,
    }))
    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }))
  }

  function applySuggestion(s: typeof SUGGESTIONS[0]) {
    setForm({ name: s.name, plural: s.plural, icon: s.icon, colour: s.colour })
    setErrors({})
  }

  function validate(): boolean {
    const errs: Partial<AddForm> = {}
    if (!form.name.trim()) errs.name = 'Name is required.'
    else if (existingNames.includes(form.name.trim().toLowerCase()))
      errs.name = 'A species with this name already exists.'
    if (!form.plural.trim()) errs.plural = 'Plural name is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setServerError(null)
    setSaving(true)
    try {
      await onAdd(form)
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add species"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="add-species-form" type="submit" loading={saving}>Add species</Button>
        </>
      }
    >
      {/* Quick-add suggestions */}
      <div className="mb-5">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Quick add</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s.name}
              type="button"
              onClick={() => applySuggestion(s)}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors',
                form.name === s.name
                  ? 'border-transparent text-white'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
              style={form.name === s.name ? { backgroundColor: 'var(--brand-primary)' } : {}}
            >
              <span>{s.icon}</span>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">Details</p>

        <form id="add-species-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="add-name"
              label="Name (singular)"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              error={errors.name}
              placeholder="Rabbit"
              required
              autoComplete="off"
            />
            <Input
              id="add-plural"
              label="Name (plural)"
              value={form.plural}
              onChange={e => {
                setForm(prev => ({ ...prev, plural: e.target.value }))
                if (errors.plural) setErrors(prev => ({ ...prev, plural: undefined }))
              }}
              error={errors.plural}
              placeholder="Rabbits"
              required
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="add-icon" className="block text-sm font-medium text-slate-700">
                Icon <span className="text-slate-400 font-normal">(emoji)</span>
              </label>
              <input
                id="add-icon"
                type="text"
                value={form.icon}
                onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="🐰"
                maxLength={4}
                className="w-full px-3.5 py-3 text-2xl text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="add-colour" className="block text-sm font-medium text-slate-700">
                Colour <span className="text-slate-400 font-normal">(calendar)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.colour}
                  onChange={e => setForm(prev => ({ ...prev, colour: e.target.value }))}
                  className="w-10 h-[46px] rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white flex-shrink-0"
                  aria-label="Species colour picker"
                />
                <input
                  id="add-colour"
                  type="text"
                  value={form.colour}
                  onChange={e => setForm(prev => ({ ...prev, colour: e.target.value }))}
                  maxLength={7}
                  placeholder="#94a3b8"
                  className="flex-1 px-3 py-3 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>
          </div>

          {serverError && (
            <p className="text-sm text-red-600" role="alert">{serverError}</p>
          )}
        </form>
      </div>
    </Modal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SpeciesPage() {
  const { business } = useBusinessContext()
  const { can, within, limit } = usePlan()

  const [species, setSpecies] = useState<Species[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const systemSpecies   = species.filter(s => s.is_system_default)
  const customSpecies   = species.filter(s => !s.is_system_default)
  const existingNames   = species.map(s => s.name.toLowerCase())

  // Diary: no custom species at all
  // Professional: up to maxCustomSpecies (2)
  // Premium: unlimited
  const canAnyCustom    = can('customSpecies')
  const canAddCustomSpecies = canAnyCustom && within('maxCustomSpecies', customSpecies.length)
  const customSpeciesLimit  = limit('maxCustomSpecies')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('species')
      .select('*')
      .order('is_system_default', { ascending: false })
      .order('sort_order')
      .order('name')
    setSpecies(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleToggle(id: string, active: boolean) {
    setSpecies(prev => prev.map(s => s.id === id ? { ...s, is_active: active } : s))
    const { error } = await supabase
      .from('species')
      .update({ is_active: active })
      .eq('id', id)
    if (error) {
      // Roll back optimistic update on failure
      setSpecies(prev => prev.map(s => s.id === id ? { ...s, is_active: !active } : s))
    }
  }

  async function handleDelete(id: string) {
    setSpecies(prev => prev.filter(s => s.id !== id))
    const { error } = await supabase.from('species').delete().eq('id', id)
    if (error) load() // Reload on failure to restore correct state
  }

  async function handleAdd(form: AddForm) {
    const { error, data } = await supabase
      .from('species')
      .insert({
        business_id:  business!.id,
        name:         form.name.trim(),
        plural_name:  form.plural.trim(),
        icon:         form.icon.trim() || null,
        colour:       form.colour || null,
        is_active:    true,
        sort_order:   customSpecies.length,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    if (data) setSpecies(prev => [...prev, data])
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Species"
        description="Configure which species your business accepts for boarding"
        backHref="/settings"
        action={
          canAnyCustom && canAddCustomSpecies ? (
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAdd(true)}
            >
              Add species
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-5">
        {/* System defaults */}
        <Card padding="none">
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              System defaults
            </h3>
          </div>
          {loading ? (
            <div className="px-5 py-6 text-sm text-slate-400">Loading…</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {systemSpecies.map(s => (
                <SpeciesRow key={s.id} species={s} />
              ))}
            </ul>
          )}
        </Card>

        {/* Custom species */}
        <Card padding="none">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Your species
            </h3>
            {canAnyCustom && customSpeciesLimit !== 'Unlimited' && (
              <span className="text-xs text-slate-400">
                {customSpecies.length} / {customSpeciesLimit} used
              </span>
            )}
          </div>
          {!canAnyCustom ? (
            <div className="px-5 pb-5">
              <PlanGate
                feature="Custom species (rabbits, birds, reptiles and more)"
                requiredPlan="PawBoard Professional"
              />
            </div>
          ) : loading ? (
            <div className="px-5 py-6 text-sm text-slate-400">Loading…</div>
          ) : customSpecies.length === 0 ? (
            <EmptyState
              icon={<PawPrint className="w-5 h-5" />}
              title="No custom species added yet"
              description="Add species beyond dogs and cats, such as rabbits, birds, reptiles or any other animals you board."
              action={
                canAddCustomSpecies ? (
                  <Button
                    variant="secondary"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => setShowAdd(true)}
                  >
                    Add species
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {customSpecies.map(s => (
                  <SpeciesRow
                    key={s.id}
                    species={s}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
              {!canAddCustomSpecies && (
                <div className="px-5 py-4 border-t border-slate-100">
                  <PlanGate
                    feature={`More than ${customSpeciesLimit} custom species`}
                    requiredPlan="PawBoard Premium"
                    limitHit
                  />
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <AddSpeciesModal
        open={showAdd}
        existingNames={existingNames}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
      />
    </div>
  )
}
