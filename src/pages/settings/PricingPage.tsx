import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Pencil, BadgePoundSterling } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card, Button, Input, Modal, EmptyState, PlanGate } from '@/components/ui'
import { usePlan } from '@/lib/plans'

// ─── Types ─────────────────────────────────────────────────────────────────────

type CalcMethod = 'nightly' | 'daily'

type PricingSettings = {
  id:                 string
  calculation_method: CalcMethod
  currency_code:      string
}

type PricingRate = {
  id:         string
  area_id:    string | null
  species_id: string | null
  pet_size:   string | null
  unit_price: number
  label:      string | null
  sort_order: number
  is_active:  boolean
}

type SharingRule = {
  id:             string
  animal_number:  number
  is_nth_onwards: boolean
  discount_type:  'fixed_price' | 'percentage_off'
  value:          number
  sort_order:     number
}

type ChargeFrequency = 'once' | 'nightly' | 'daily' | 'adhoc'

const FREQ_LABELS: Record<ChargeFrequency, string> = {
  once:    'Once per stay',
  nightly: 'Per night',
  daily:   'Per day',
  adhoc:   'Ad hoc (enter qty)',
}

type ExtrasCatalogItem = {
  id:               string
  name:             string
  description:      string | null
  unit_price:       number
  charge_frequency: ChargeFrequency
  is_active:        boolean
  sort_order:       number
}

type AreaOption    = { id: string; name: string }
type SpeciesOption = { id: string; name: string; icon: string | null }

// ─── Helpers ───────────────────────────────────────────────────────────────────

const SIZE_LABELS: Record<string, string> = {
  toy: 'Toy', small: 'Small', medium: 'Medium', large: 'Large', giant: 'Giant',
}
const ALL_SIZES = ['toy', 'small', 'medium', 'large', 'giant']

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function fmt(n: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(n)
}

// ─── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer"
      style={{ backgroundColor: checked ? 'var(--brand-primary)' : '#cbd5e1' }}>
      <span className={['inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
    </button>
  )
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, description, action }: {
  title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-slate-100">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Calculation method ────────────────────────────────────────────────────────

const CALC_OPTIONS: { value: CalcMethod; label: string; description: string }[] = [
  { value: 'nightly', label: 'Nightly', description: 'Charge per night (nights = end − start)' },
  { value: 'daily',   label: 'Daily',   description: 'Charge per day including arrival (days = nights + 1)' },
]

function CalcMethodSection({
  settings, onUpdate,
}: {
  settings: PricingSettings | null
  onUpdate: (method: CalcMethod, currency: string) => void
}) {
  const [currency, setCurrency] = useState(settings?.currency_code ?? 'GBP')

  useEffect(() => { setCurrency(settings?.currency_code ?? 'GBP') }, [settings])

  return (
    <Card padding="none">
      <SectionHeader title="Calculation method" description="How duration is measured when estimating booking costs" />
      <div className="px-5 py-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CALC_OPTIONS.map(opt => {
            const active = settings?.calculation_method === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onUpdate(opt.value, currency)}
                className={[
                  'text-left px-4 py-3 rounded-lg border transition-all',
                  active
                    ? 'border-transparent shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
                style={active ? { borderColor: 'var(--brand-primary)', backgroundColor: 'color-mix(in srgb, var(--brand-primary) 6%, white)' } : {}}
              >
                <p className={['text-sm font-semibold', active ? '' : 'text-slate-700'].join(' ')}
                   style={active ? { color: 'var(--brand-primary)' } : {}}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-28">
            <Input
              id="currency" label="Currency"
              value={currency}
              onChange={e => setCurrency(e.target.value.toUpperCase())}
              onBlur={() => settings && onUpdate(settings.calculation_method, currency)}
              maxLength={3}
              placeholder="GBP"
            />
          </div>
          <p className="text-xs text-slate-400 mt-5">ISO 4217 code — GBP, EUR, USD, etc.</p>
        </div>
      </div>
    </Card>
  )
}

// ─── Rate card ─────────────────────────────────────────────────────────────────

type RateForm = {
  area_id:    string
  species_id: string
  pet_size:   string
  unit_price: string
  label:      string
}
const BLANK_RATE: RateForm = { area_id: '', species_id: '', pet_size: '', unit_price: '', label: '' }

function RateModal({
  open, existing, areas, species, onClose, onSave,
}: {
  open:     boolean
  existing: PricingRate | null
  areas:    AreaOption[]
  species:  SpeciesOption[]
  onClose:  () => void
  onSave:   (f: RateForm) => Promise<void>
}) {
  const [form,   setForm]   = useState<RateForm>(BLANK_RATE)
  const [error,  setError]  = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm({
        area_id:    existing.area_id    ?? '',
        species_id: existing.species_id ?? '',
        pet_size:   existing.pet_size   ?? '',
        unit_price: String(existing.unit_price),
        label:      existing.label      ?? '',
      })
    } else { setForm(BLANK_RATE) }
    setError(null); setSaving(false)
  }, [open, existing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = parseFloat(form.unit_price)
    if (isNaN(price) || price < 0) { setError('Enter a valid price'); return }
    setSaving(true); setError(null)
    try { await onSave(form); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong') }
    finally { setSaving(false) }
  }

  const sel = (label: string, id: string, value: string, onChange: (v: string) => void, children: React.ReactNode) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
        {children}
      </select>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit rate' : 'Add rate'} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button form="rate-form" type="submit" loading={saving}>{existing ? 'Save' : 'Add rate'}</Button>
      </>}
    >
      <form id="rate-form" onSubmit={handleSubmit} className="space-y-3" noValidate>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
        {sel('Area', 'rate-area', form.area_id, v => setForm(p => ({ ...p, area_id: v })), <>
          <option value="">Any area</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </>)}
        {sel('Species', 'rate-species', form.species_id, v => setForm(p => ({ ...p, species_id: v })), <>
          <option value="">Any species</option>
          {species.map(s => <option key={s.id} value={s.id}>{s.icon ? s.icon + ' ' : ''}{s.name}</option>)}
        </>)}
        {sel('Pet size', 'rate-size', form.pet_size, v => setForm(p => ({ ...p, pet_size: v })), <>
          <option value="">Any size</option>
          {ALL_SIZES.map(sz => <option key={sz} value={sz}>{SIZE_LABELS[sz]}</option>)}
        </>)}
        <div className="grid grid-cols-2 gap-3">
          <Input id="rate-price" label="Price per unit" type="number" min="0" step="0.01" required
            value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))}
            placeholder="25.00" />
          <Input id="rate-label" label="Label (optional)"
            value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            placeholder="Standard kennel" autoComplete="off" />
        </div>
        <p className="text-xs text-slate-400">Leave area/species/size blank to use as a fallback for any combination.</p>
      </form>
    </Modal>
  )
}

function RateRow({
  rate, areas, species, currency, onToggle, onEdit, onDelete,
}: {
  rate:     PricingRate
  areas:    AreaOption[]
  species:  SpeciesOption[]
  currency: string
  onToggle: (id: string, v: boolean) => void
  onEdit:   (r: PricingRate) => void
  onDelete: (id: string) => void
}) {
  const [confirm, setConfirm] = useState(false)
  const areaName    = areas.find(a => a.id === rate.area_id)?.name    ?? 'Any area'
  const speciesItem = species.find(s => s.id === rate.species_id)
  const speciesName = speciesItem ? `${speciesItem.icon ? speciesItem.icon + ' ' : ''}${speciesItem.name}` : 'Any species'
  const sizeName    = rate.pet_size ? SIZE_LABELS[rate.pet_size] : 'Any size'

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {[areaName, speciesName, sizeName].map((tag, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{tag}</span>
          ))}
          {rate.label && <span className="text-xs text-slate-400 italic">{rate.label}</span>}
        </div>
        <p className="text-sm font-semibold text-slate-900 mt-1">{fmt(rate.unit_price, currency)}<span className="text-xs font-normal text-slate-400"> / unit</span></p>
      </div>
      <Toggle checked={rate.is_active} onChange={v => onToggle(rate.id, v)} />
      {!confirm && <>
        <button onClick={() => onEdit(rate)} className="p-1.5 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setConfirm(true)} className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </>}
      {confirm && <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Remove?</span>
        <button onClick={() => { onDelete(rate.id); setConfirm(false) }} className="text-xs font-medium text-red-600">Yes</button>
        <button onClick={() => setConfirm(false)} className="text-xs font-medium text-slate-500">Cancel</button>
      </div>}
    </li>
  )
}

// ─── Sharing rules ─────────────────────────────────────────────────────────────

type SharingForm = {
  animal_number:  string
  is_nth_onwards: boolean
  discount_type:  'fixed_price' | 'percentage_off'
  value:          string
}
const BLANK_SHARING: SharingForm = { animal_number: '2', is_nth_onwards: false, discount_type: 'percentage_off', value: '' }

function SharingModal({
  open, existing, onClose, onSave,
}: {
  open:     boolean
  existing: SharingRule | null
  onClose:  () => void
  onSave:   (f: SharingForm) => Promise<void>
}) {
  const [form, setForm] = useState<SharingForm>(BLANK_SHARING)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm({
        animal_number:  String(existing.animal_number),
        is_nth_onwards: existing.is_nth_onwards,
        discount_type:  existing.discount_type,
        value:          String(existing.value),
      })
    } else { setForm(BLANK_SHARING) }
    setError(null); setSaving(false)
  }, [open, existing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseInt(form.animal_number)
    const val = parseFloat(form.value)
    if (!num || num < 1) { setError('Animal number must be 1 or more'); return }
    if (isNaN(val) || val < 0) { setError('Enter a valid value'); return }
    if (form.discount_type === 'percentage_off' && val > 100) { setError('Percentage cannot exceed 100'); return }
    setSaving(true); setError(null)
    try { await onSave(form); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit sharing rule' : 'Add sharing rule'} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button form="sharing-form" type="submit" loading={saving}>{existing ? 'Save' : 'Add rule'}</Button>
      </>}
    >
      <form id="sharing-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="space-y-1.5">
          <label htmlFor="share-num" className="block text-sm font-medium text-slate-700">Animal number <span className="text-red-500">*</span></label>
          <div className="flex items-center gap-3">
            <input id="share-num" type="number" min="1" max="20" required
              value={form.animal_number}
              onChange={e => setForm(p => ({ ...p, animal_number: e.target.value }))}
              className="w-20 px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.is_nth_onwards}
                onChange={e => setForm(p => ({ ...p, is_nth_onwards: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 accent-emerald-600" />
              <span className="text-sm text-slate-700">and onwards</span>
            </label>
          </div>
          <p className="text-xs text-slate-400">
            {form.animal_number && parseInt(form.animal_number) >= 1
              ? `Applies to the ${ordinal(parseInt(form.animal_number))} animal${form.is_nth_onwards ? ' and all subsequent animals' : ' only'}`
              : ''}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Pricing for this animal</p>
          {(['percentage_off', 'fixed_price'] as const).map(type => (
            <label key={type} className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" name="discount_type" value={type}
                checked={form.discount_type === type}
                onChange={() => setForm(p => ({ ...p, discount_type: type }))}
                className="w-4 h-4 border-slate-300 accent-emerald-600" />
              <span className="text-sm text-slate-700">
                {type === 'percentage_off' ? 'Percentage off base price' : 'Fixed price (overrides base rate)'}
              </span>
            </label>
          ))}
        </div>
        <Input id="share-value" label={form.discount_type === 'percentage_off' ? 'Discount %' : 'Fixed price'} required
          type="number" min="0" step={form.discount_type === 'percentage_off' ? '1' : '0.01'}
          value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
          placeholder={form.discount_type === 'percentage_off' ? '50' : '15.00'} />
      </form>
    </Modal>
  )
}

function SharingRuleRow({
  rule, currency, onEdit, onDelete,
}: {
  rule:     SharingRule
  currency: string
  onEdit:   (r: SharingRule) => void
  onDelete: (id: string) => void
}) {
  const [confirm, setConfirm] = useState(false)
  const animalLabel = rule.is_nth_onwards
    ? `${ordinal(rule.animal_number)} animal onwards`
    : `${ordinal(rule.animal_number)} animal`
  const discountLabel = rule.discount_type === 'percentage_off'
    ? `${rule.value}% off`
    : `${fmt(rule.value, currency)} flat`

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-900 capitalize">{animalLabel}</span>
        <span className="text-slate-300 mx-2">·</span>
        <span className="text-sm text-slate-600">{discountLabel}</span>
      </div>
      {!confirm && <>
        <button onClick={() => onEdit(rule)} className="p-1.5 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={() => setConfirm(true)} className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      </>}
      {confirm && <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Remove?</span>
        <button onClick={() => { onDelete(rule.id); setConfirm(false) }} className="text-xs font-medium text-red-600">Yes</button>
        <button onClick={() => setConfirm(false)} className="text-xs font-medium text-slate-500">Cancel</button>
      </div>}
    </li>
  )
}

// ─── Extras catalog ────────────────────────────────────────────────────────────

type ExtraForm = { name: string; description: string; unit_price: string; charge_frequency: ChargeFrequency }
const BLANK_EXTRA: ExtraForm = { name: '', description: '', unit_price: '', charge_frequency: 'once' }

function ExtraModal({
  open, existing, onClose, onSave,
}: {
  open:     boolean
  existing: ExtrasCatalogItem | null
  onClose:  () => void
  onSave:   (f: ExtraForm) => Promise<void>
}) {
  const [form, setForm] = useState<ExtraForm>(BLANK_EXTRA)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm({ name: existing.name, description: existing.description ?? '', unit_price: String(existing.unit_price), charge_frequency: existing.charge_frequency })
    } else { setForm(BLANK_EXTRA) }
    setError(null); setSaving(false)
  }, [open, existing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    const price = parseFloat(form.unit_price)
    if (isNaN(price) || price < 0) { setError('Enter a valid price'); return }
    setSaving(true); setError(null)
    try { await onSave({ ...form, name: form.name.trim() }); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit extra' : 'Add extra'} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button form="extra-form" type="submit" loading={saving}>{existing ? 'Save' : 'Add extra'}</Button>
      </>}
    >
      <form id="extra-form" onSubmit={handleSubmit} className="space-y-3" noValidate>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Input id="extra-name" label="Name" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Dog grooming" autoComplete="off" />
        <div className="space-y-1.5">
          <label htmlFor="extra-desc" className="block text-sm font-medium text-slate-700">Description <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea id="extra-desc" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Full bath and brush"
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
        </div>
        <Input id="extra-price" label="Price" required type="number" min="0" step="0.01"
          value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} placeholder="30.00" />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-700">How often</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(FREQ_LABELS) as [ChargeFrequency, string][]).map(([value, label]) => {
              const active = form.charge_frequency === value
              return (
                <button key={value} type="button" onClick={() => setForm(p => ({ ...p, charge_frequency: value }))}
                  className={['text-center px-2 py-2 rounded-lg border text-xs font-medium transition-all', active ? 'border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300'].join(' ')}
                  style={active ? { borderColor: 'var(--brand-primary)', backgroundColor: 'color-mix(in srgb, var(--brand-primary) 8%, white)', color: 'var(--brand-primary)' } : {}}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </form>
    </Modal>
  )
}

function ExtraRow({
  item, currency, onToggle, onEdit, onDelete,
}: {
  item:     ExtrasCatalogItem
  currency: string
  onToggle: (id: string, v: boolean) => void
  onEdit:   (i: ExtrasCatalogItem) => void
  onDelete: (id: string) => void
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{item.name}</p>
        {item.description && <p className="text-xs text-slate-400 truncate">{item.description}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-slate-900">{fmt(item.unit_price, currency)}</p>
        <p className="text-xs text-slate-400">{FREQ_LABELS[item.charge_frequency]}</p>
      </div>
      <Toggle checked={item.is_active} onChange={v => onToggle(item.id, v)} />
      {!confirm && <>
        <button onClick={() => onEdit(item)} className="p-1.5 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={() => setConfirm(true)} className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      </>}
      {confirm && <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Remove?</span>
        <button onClick={() => { onDelete(item.id); setConfirm(false) }} className="text-xs font-medium text-red-600">Yes</button>
        <button onClick={() => setConfirm(false)} className="text-xs font-medium text-slate-500">Cancel</button>
      </div>}
    </li>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { business } = useBusinessContext()
  const { can } = usePlan()
  const canPricing = can('pricingEngine')
  const [settings,     setSettings]     = useState<PricingSettings | null>(null)
  const [rates,        setRates]        = useState<PricingRate[]>([])
  const [sharingRules, setSharingRules] = useState<SharingRule[]>([])
  const [extras,       setExtras]       = useState<ExtrasCatalogItem[]>([])
  const [areas,        setAreas]        = useState<AreaOption[]>([])
  const [species,      setSpecies]      = useState<SpeciesOption[]>([])
  const [loading,      setLoading]      = useState(true)

  const [rateModal,    setRateModal]    = useState(false)
  const [sharingModal, setSharingModal] = useState(false)
  const [extraModal,   setExtraModal]   = useState(false)
  const [editRate,     setEditRate]     = useState<PricingRate | null>(null)
  const [editSharing,  setEditSharing]  = useState<SharingRule | null>(null)
  const [editExtra,    setEditExtra]    = useState<ExtrasCatalogItem | null>(null)

  const currency = settings?.currency_code ?? 'GBP'

  const load = useCallback(async () => {
    if (!business) return
    setLoading(true)
    const [sRes, rRes, srRes, eRes, aRes, spRes] = await Promise.all([
      supabase.from('pricing_settings').select('*').eq('business_id', business.id).maybeSingle(),
      supabase.from('pricing_rates').select('*').order('sort_order').order('created_at'),
      supabase.from('pricing_sharing_rules').select('*').order('sort_order').order('animal_number'),
      supabase.from('booking_extras_catalog').select('*').order('sort_order').order('name'),
      supabase.from('accommodation_areas').select('id, name').eq('is_active', true).order('sort_order'),
      supabase.from('species').select('id, name, icon').eq('is_active', true).order('sort_order').order('name'),
    ])
    setSettings(sRes.data as PricingSettings | null)
    setRates((rRes.data ?? []) as PricingRate[])
    setSharingRules((srRes.data ?? []) as SharingRule[])
    setExtras((eRes.data ?? []) as ExtrasCatalogItem[])
    setAreas((aRes.data ?? []) as AreaOption[])
    setSpecies((spRes.data ?? []) as SpeciesOption[])
    setLoading(false)
  }, [business])

  useEffect(() => { load() }, [load])

  async function upsertSettings(method: CalcMethod, currencyCode: string) {
    if (!business) return
    const payload = { business_id: business.id, calculation_method: method, currency_code: currencyCode }
    if (settings) {
      const { error } = await supabase.from('pricing_settings').update(payload).eq('id', settings.id)
      if (!error) setSettings(s => s ? { ...s, calculation_method: method, currency_code: currencyCode } : s)
    } else {
      const { data, error } = await supabase.from('pricing_settings').insert(payload).select().single()
      if (!error && data) setSettings(data as PricingSettings)
    }
  }

  async function saveRate(form: RateForm) {
    if (!business) return
    const payload = {
      business_id: business.id,
      area_id:    form.area_id    || null,
      species_id: form.species_id || null,
      pet_size:   form.pet_size   || null,
      unit_price: parseFloat(form.unit_price),
      label:      form.label.trim() || null,
      sort_order: editRate ? editRate.sort_order : rates.length,
      is_active:  true,
    }
    if (editRate) {
      const { error } = await supabase.from('pricing_rates').update(payload).eq('id', editRate.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase.from('pricing_rates').insert(payload)
      if (error) throw new Error(error.message)
    }
    await load()
  }

  async function toggleRate(id: string, v: boolean) {
    setRates(prev => prev.map(r => r.id === id ? { ...r, is_active: v } : r))
    await supabase.from('pricing_rates').update({ is_active: v }).eq('id', id)
  }

  async function deleteRate(id: string) {
    setRates(prev => prev.filter(r => r.id !== id))
    await supabase.from('pricing_rates').delete().eq('id', id)
  }

  async function saveSharing(form: SharingForm) {
    if (!business) return
    const payload = {
      business_id:    business.id,
      animal_number:  parseInt(form.animal_number),
      is_nth_onwards: form.is_nth_onwards,
      discount_type:  form.discount_type,
      value:          parseFloat(form.value),
      sort_order:     editSharing ? editSharing.sort_order : sharingRules.length,
    }
    if (editSharing) {
      const { error } = await supabase.from('pricing_sharing_rules').update(payload).eq('id', editSharing.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase.from('pricing_sharing_rules').insert(payload)
      if (error) throw new Error(error.message)
    }
    await load()
  }

  async function deleteSharing(id: string) {
    setSharingRules(prev => prev.filter(r => r.id !== id))
    await supabase.from('pricing_sharing_rules').delete().eq('id', id)
  }

  async function saveExtra(form: ExtraForm) {
    if (!business) return
    const payload = {
      business_id:      business.id,
      name:             form.name,
      description:      form.description.trim() || null,
      unit_price:       parseFloat(form.unit_price),
      charge_frequency: form.charge_frequency,
      sort_order:       editExtra ? editExtra.sort_order : extras.length,
      is_active:        true,
    }
    if (editExtra) {
      const { error } = await supabase.from('booking_extras_catalog').update(payload).eq('id', editExtra.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase.from('booking_extras_catalog').insert(payload)
      if (error) throw new Error(error.message)
    }
    await load()
  }

  async function toggleExtra(id: string, v: boolean) {
    setExtras(prev => prev.map(e => e.id === id ? { ...e, is_active: v } : e))
    await supabase.from('booking_extras_catalog').update({ is_active: v }).eq('id', id)
  }

  async function deleteExtra(id: string) {
    setExtras(prev => prev.filter(e => e.id !== id))
    await supabase.from('booking_extras_catalog').delete().eq('id', id)
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Pricing"
        description="Configure rates, sharing discounts, and extras"
        backHref="/settings"
      />

      {!canPricing ? (
        <PlanGate feature="Pricing engine" requiredPlan="PawBoard Professional" />
      ) : loading ? (
        <Card><p className="text-sm text-slate-400 py-6 text-center">Loading…</p></Card>
      ) : (
        <div className="space-y-5">
          {/* Calculation method */}
          <CalcMethodSection
            settings={settings}
            onUpdate={upsertSettings}
          />

          {/* Rate card */}
          <Card padding="none">
            <SectionHeader
              title="Rate card"
              description="Base prices per area, species, and optionally pet size"
              action={
                <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => { setEditRate(null); setRateModal(true) }}>
                  Add rate
                </Button>
              }
            />
            {rates.length === 0 ? (
              <EmptyState
                icon={<BadgePoundSterling className="w-5 h-5" />}
                title="No rates yet"
                description="Add base prices for your areas and species. Leave area or species blank for a catch-all fallback."
                action={<Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => { setEditRate(null); setRateModal(true) }}>Add rate</Button>}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {rates.map(r => (
                  <RateRow key={r.id} rate={r} areas={areas} species={species} currency={currency}
                    onToggle={toggleRate} onEdit={r => { setEditRate(r); setRateModal(true) }} onDelete={deleteRate} />
                ))}
              </ul>
            )}
          </Card>

          {/* Sharing discounts */}
          <Card padding="none">
            <SectionHeader
              title="Sharing discounts"
              description="Price adjustments when multiple pets occupy the same space"
              action={
                <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => { setEditSharing(null); setSharingModal(true) }}>
                  Add rule
                </Button>
              }
            />
            {sharingRules.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400 italic">
                No sharing rules — all pets charged at the base rate.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sharingRules
                  .slice()
                  .sort((a, b) => a.animal_number - b.animal_number || (a.is_nth_onwards ? 1 : -1))
                  .map(r => (
                    <SharingRuleRow key={r.id} rule={r} currency={currency}
                      onEdit={r => { setEditSharing(r); setSharingModal(true) }} onDelete={deleteSharing} />
                  ))}
              </ul>
            )}
          </Card>

          {/* Extras catalog */}
          <Card padding="none">
            <SectionHeader
              title="Extras catalog"
              description="Add-on services and charges that can be applied to any booking"
              action={
                <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => { setEditExtra(null); setExtraModal(true) }}>
                  Add extra
                </Button>
              }
            />
            {extras.length === 0 ? (
              <EmptyState
                icon={<Plus className="w-5 h-5" />}
                title="No extras yet"
                description="Add services like grooming, heating supplements, or custom charges."
                action={<Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => { setEditExtra(null); setExtraModal(true) }}>Add extra</Button>}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {extras.map(e => (
                  <ExtraRow key={e.id} item={e} currency={currency}
                    onToggle={toggleExtra} onEdit={e => { setEditExtra(e); setExtraModal(true) }} onDelete={deleteExtra} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <RateModal open={rateModal} existing={editRate} areas={areas} species={species}
        onClose={() => setRateModal(false)} onSave={saveRate} />
      <SharingModal open={sharingModal} existing={editSharing}
        onClose={() => setSharingModal(false)} onSave={saveSharing} />
      <ExtraModal open={extraModal} existing={editExtra}
        onClose={() => setExtraModal(false)} onSave={saveExtra} />
    </div>
  )
}
