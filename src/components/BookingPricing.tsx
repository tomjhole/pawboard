import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Sparkles, Receipt } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { Button, Input, Modal } from '@/components/ui'

// ─── Types ─────────────────────────────────────────────────────────────────────

type LineItem = {
  id:          string
  booking_id:  string
  description: string
  quantity:    number
  unit_price:  number
  total_price: number
  source:      'rate' | 'extra' | 'custom'
  sort_order:  number
}

type ChargeFrequency = 'once' | 'nightly' | 'daily' | 'adhoc'

type ExtrasCatalogItem = {
  id:               string
  name:             string
  unit_price:       number
  charge_frequency: ChargeFrequency
}

type PricingSettings = {
  calculation_method: 'nightly' | 'daily' | 'part_day'
  currency_code:      string
}

type PricingRate = {
  id:         string
  area_id:    string | null
  species_id: string | null
  pet_size:   string | null
  unit_price: number
  label:      string | null
}

type SharingRule = {
  animal_number:  number
  is_nth_onwards: boolean
  discount_type:  'fixed_price' | 'percentage_off'
  value:          number
}

type BookingPet = {
  id:     string
  pet: {
    id:         string
    name:       string
    size:       string | null
    species_id: string | null
  } | null
  booking_space_assignments: {
    space: { id: string; area_id: string | null } | null
  }[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function nightsBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000
  )
}

function fmt(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount)
}

// Find the best rate for a pet — highest specificity wins
function matchRate(
  rates: PricingRate[],
  areaId: string | null,
  speciesId: string | null,
  size: string | null,
): PricingRate | null {
  let best: PricingRate | null = null
  let bestScore = -1

  for (const r of rates) {
    const areaMatch    = r.area_id    === null || r.area_id    === areaId
    const speciesMatch = r.species_id === null || r.species_id === speciesId
    const sizeMatch    = r.pet_size   === null || r.pet_size   === size

    if (!areaMatch || !speciesMatch || !sizeMatch) continue

    const score =
      (r.area_id    !== null ? 4 : 0) +
      (r.species_id !== null ? 2 : 0) +
      (r.pet_size   !== null ? 1 : 0)

    if (score > bestScore) { best = r; bestScore = score }
  }
  return best
}

// Compute unit price for the Nth animal in a space, applying sharing rules
function applySharing(
  basePrice: number,
  animalIndex: number, // 0-based (0 = 1st animal)
  rules: SharingRule[],
): number {
  const n = animalIndex + 1 // 1-based
  const matchingRules = rules.filter(r =>
    r.animal_number === n || (r.is_nth_onwards && n >= r.animal_number)
  )
  // Pick highest animal_number rule that applies (most specific)
  const rule = matchingRules.sort((a, b) => b.animal_number - a.animal_number)[0]
  if (!rule) return basePrice
  if (rule.discount_type === 'percentage_off') return basePrice * (1 - rule.value / 100)
  return rule.value // fixed price
}

function buildEstimate(
  pets: BookingPet[],
  startDate: string,
  endDate: string,
  settings: PricingSettings,
  rates: PricingRate[],
  sharingRules: SharingRule[],
): Omit<LineItem, 'id' | 'booking_id'>[] {
  const nights = nightsBetween(startDate, endDate)
  const units  = settings.calculation_method === 'nightly'  ? nights
               : settings.calculation_method === 'daily'    ? nights + 1
               : 1

  // Group pets by space (for sharing)
  const spaceGroups = new Map<string | null, BookingPet[]>()
  for (const bp of pets) {
    const spaceId = bp.booking_space_assignments[0]?.space?.id ?? null
    const list = spaceGroups.get(spaceId) ?? []
    list.push(bp)
    spaceGroups.set(spaceId, list)
  }

  const items: Omit<LineItem, 'id' | 'booking_id'>[] = []
  let sortOrder = 0

  for (const [, groupPets] of spaceGroups) {
    groupPets.forEach((bp, idx) => {
      const pet       = bp.pet
      const areaId    = bp.booking_space_assignments[0]?.space?.area_id ?? null
      const speciesId = pet?.species_id ?? null
      const size      = pet?.size ?? null
      const rate      = matchRate(rates, areaId, speciesId, size)
      if (!rate) return

      const basePrice   = rate.unit_price
      const unitPrice   = idx === 0 ? basePrice : applySharing(basePrice, idx, sharingRules)
      const totalPrice  = unitPrice * units

      const methodLabel = settings.calculation_method === 'nightly' ? 'night'
                        : settings.calculation_method === 'daily'   ? 'day'
                        : 'stay'
      const label = rate.label
        ? `${pet?.name ?? 'Pet'} — ${rate.label}`
        : `${pet?.name ?? 'Pet'} — boarding`

      items.push({
        description: label,
        quantity:    units,
        unit_price:  Math.round(unitPrice * 100) / 100,
        total_price: Math.round(totalPrice * 100) / 100,
        source:      'rate',
        sort_order:  sortOrder++,
      })
    })
  }

  return items
}

// ─── Custom line item modal ────────────────────────────────────────────────────

type CustomForm = { description: string; quantity: string; unit_price: string }
const BLANK_CUSTOM: CustomForm = { description: '', quantity: '1', unit_price: '' }

function CustomLineModal({
  open, onClose, onAdd, prefill,
}: {
  open:    boolean
  onClose: () => void
  onAdd:   (desc: string, qty: number, price: number) => void
  prefill?: { description: string; unit_price: string }
}) {
  const [form, setForm] = useState<CustomForm>(BLANK_CUSTOM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(prefill ? { description: prefill.description, quantity: '1', unit_price: prefill.unit_price } : BLANK_CUSTOM)
      setError(null)
    }
  }, [open, prefill])

  function handle(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) { setError('Description is required'); return }
    const qty   = parseFloat(form.quantity)
    const price = parseFloat(form.unit_price)
    if (isNaN(qty)   || qty   <= 0) { setError('Quantity must be greater than 0'); return }
    if (isNaN(price) || price <  0) { setError('Enter a valid price'); return }
    onAdd(form.description.trim(), qty, price)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add custom charge" size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button form="custom-line-form" type="submit">Add</Button>
      </>}
    >
      <form id="custom-line-form" onSubmit={handle} className="space-y-3" noValidate>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Input id="cl-desc" label="Description" required
          value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="Dog grooming" autoComplete="off" />
        <div className="grid grid-cols-2 gap-3">
          <Input id="cl-qty" label="Quantity" type="number" min="0.01" step="0.01" required
            value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
          <Input id="cl-price" label="Unit price" type="number" min="0" step="0.01" required
            value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))}
            placeholder="0.00" />
        </div>
      </form>
    </Modal>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export interface BookingPricingProps {
  bookingId:  string
  startDate:  string
  endDate:    string
  pets:       BookingPet[]
  onTotalChanged?: (total: number) => void
}

export default function BookingPricing({ bookingId, startDate, endDate, pets, onTotalChanged }: BookingPricingProps) {
  const { business } = useBusinessContext()
  const [items,        setItems]        = useState<LineItem[]>([])
  const [catalog,      setCatalog]      = useState<ExtrasCatalogItem[]>([])
  const [settings,     setSettings]     = useState<PricingSettings | null>(null)
  const [rates,        setRates]        = useState<PricingRate[]>([])
  const [sharingRules, setSharingRules] = useState<SharingRule[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [estimating,   setEstimating]   = useState(false)
  const [customOpen,   setCustomOpen]   = useState(false)
  const [catalogOpen,  setCatalogOpen]  = useState(false)
  const [adhocItem,    setAdhocItem]    = useState<ExtrasCatalogItem | null>(null)
  const [totalSaved,   setTotalSaved]   = useState(false)
  const [currency,     setCurrency]     = useState('GBP')
  const [catalogDropUp, setCatalogDropUp] = useState(false)
  const catalogWrapRef = useRef<HTMLDivElement>(null)

  function toggleCatalog() {
    if (!catalogOpen) {
      const rect = catalogWrapRef.current?.getBoundingClientRect()
      // Open upward when there isn't room for the menu below the button
      if (rect) setCatalogDropUp(window.innerHeight - rect.bottom < 300)
    }
    setCatalogOpen(v => !v)
  }

  const total = items.reduce((s, i) => s + i.total_price, 0)

  const load = useCallback(async () => {
    if (!business) return
    setLoading(true)
    const [liRes, catRes, psRes, rRes, srRes] = await Promise.all([
      supabase.from('booking_line_items').select('*').eq('booking_id', bookingId).order('sort_order').order('created_at'),
      supabase.from('booking_extras_catalog').select('id, name, unit_price, charge_frequency').eq('business_id', business.id).eq('is_active', true).order('sort_order').order('name'),
      supabase.from('pricing_settings').select('calculation_method, currency_code').eq('business_id', business.id).maybeSingle(),
      supabase.from('pricing_rates').select('id, area_id, species_id, pet_size, unit_price, label').eq('business_id', business.id).eq('is_active', true),
      supabase.from('pricing_sharing_rules').select('animal_number, is_nth_onwards, discount_type, value').eq('business_id', business.id).order('animal_number'),
    ])
    setItems((liRes.data ?? []) as LineItem[])
    setCatalog((catRes.data ?? []) as ExtrasCatalogItem[])
    if (psRes.data) {
      setSettings(psRes.data as PricingSettings)
      setCurrency(psRes.data.currency_code)
    }
    setRates((rRes.data ?? []) as PricingRate[])
    setSharingRules((srRes.data ?? []) as SharingRule[])
    setLoading(false)
  }, [business, bookingId])

  useEffect(() => { load() }, [load])

  useEffect(() => { onTotalChanged?.(total) }, [total, onTotalChanged])

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('booking_line_items').delete().eq('id', id)
    setTotalSaved(false)
  }

  async function addItem(description: string, quantity: number, unit_price: number, source: LineItem['source']) {
    const total_price = Math.round(quantity * unit_price * 100) / 100
    const sort_order  = items.length
    const { data, error } = await supabase
      .from('booking_line_items')
      .insert({ booking_id: bookingId, description, quantity, unit_price, total_price, source, sort_order })
      .select()
      .single()
    if (!error && data) {
      setItems(prev => [...prev, data as LineItem])
      setTotalSaved(false)
    }
  }

  async function handleEstimate() {
    if (!settings) return
    setEstimating(true)
    try {
      // Clear existing 'rate' items first
      const rateIds = items.filter(i => i.source === 'rate').map(i => i.id)
      if (rateIds.length > 0) {
        await supabase.from('booking_line_items').delete().in('id', rateIds)
        setItems(prev => prev.filter(i => i.source !== 'rate'))
      }

      const estimate = buildEstimate(pets, startDate, endDate, settings, rates, sharingRules)
      if (estimate.length === 0) return

      const rows = estimate.map(e => ({ ...e, booking_id: bookingId }))
      const { data, error } = await supabase.from('booking_line_items').insert(rows).select()
      if (!error && data) {
        setItems(prev => [...prev.filter(i => i.source !== 'rate'), ...(data as LineItem[])])
        setTotalSaved(false)
      }
    } finally { setEstimating(false) }
  }

  async function saveTotal() {
    setSaving(true)
    await supabase.from('bookings').update({ total_amount: total }).eq('id', bookingId)
    setSaving(false)
    setTotalSaved(true)
  }

  if (loading) {
    return <p className="text-sm text-slate-400 py-2">Loading pricing…</p>
  }

  const hasRates    = rates.length > 0
  const hasCatalog  = catalog.length > 0

  return (
    <div>
      {/* Line items */}
      {items.length === 0 ? (
        <div className="text-center py-6">
          <Receipt className="w-7 h-7 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No charges added yet</p>
          {hasRates && (
            <p className="text-xs text-slate-300 mt-1">Use "Estimate from rates" to auto-calculate, or add items manually below.</p>
          )}
        </div>
      ) : (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-3">Description</th>
              <th className="text-right text-xs font-medium text-slate-400 pb-2 pr-3 w-12">Qty</th>
              <th className="text-right text-xs font-medium text-slate-400 pb-2 pr-3 w-20">Unit</th>
              <th className="text-right text-xs font-medium text-slate-400 pb-2 w-20">Total</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-slate-50 group">
                <td className="py-2 pr-3 text-slate-900">{item.description}</td>
                <td className="py-2 pr-3 text-right text-slate-500">{item.quantity}</td>
                <td className="py-2 pr-3 text-right text-slate-500">{fmt(item.unit_price, currency)}</td>
                <td className="py-2 text-right font-medium text-slate-900">{fmt(item.total_price, currency)}</td>
                <td className="py-2 pl-2">
                  <button onClick={() => deleteItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-red-500 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="pt-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide pr-3">Total</td>
              <td className="pt-3 text-right font-bold text-slate-900">{fmt(total, currency)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {hasRates && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={handleEstimate}
            loading={estimating}
          >
            {items.some(i => i.source === 'rate') ? 'Re-estimate from rates' : 'Estimate from rates'}
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setCustomOpen(true)}>
          Custom charge
        </Button>
        {hasCatalog && (
          <div className="relative" ref={catalogWrapRef}>
            <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={toggleCatalog}>
              From catalog
            </Button>
            {catalogOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setCatalogOpen(false)} />
                <div className={[
                  'absolute left-0 z-40 min-w-48 rounded-lg shadow-lg border border-slate-200 bg-white py-1 max-h-64 overflow-y-auto',
                  catalogDropUp ? 'bottom-full mb-1' : 'top-full mt-1',
                ].join(' ')}>
                  {catalog.map(item => {
                    const nights = nightsBetween(startDate, endDate)
                    const qty = item.charge_frequency === 'nightly' ? nights
                              : item.charge_frequency === 'daily'   ? nights + 1
                              : 1
                    const freqLabel = item.charge_frequency === 'nightly' ? 'per night'
                                    : item.charge_frequency === 'daily'   ? 'per day'
                                    : item.charge_frequency === 'adhoc'   ? 'ad hoc — enter qty'
                                    : 'once'
                    return (
                      <button key={item.id} onClick={() => {
                        setCatalogOpen(false)
                        if (item.charge_frequency === 'adhoc') {
                          setAdhocItem(item)
                          setCustomOpen(true)
                        } else {
                          addItem(item.name, qty, item.unit_price, 'extra')
                        }
                      }}
                        className="w-full flex items-center justify-between gap-4 px-3.5 py-2 text-sm hover:bg-slate-50 text-left">
                        <div className="min-w-0">
                          <p className="text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-400">{freqLabel}</p>
                        </div>
                        <span className="text-slate-400 flex-shrink-0 text-xs">{fmt(item.unit_price, currency)}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {items.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            {totalSaved && <span className="text-xs text-emerald-600">Saved</span>}
            <Button size="sm" onClick={saveTotal} loading={saving}>
              Save total to booking
            </Button>
          </div>
        )}
      </div>

      <CustomLineModal
        open={customOpen}
        prefill={adhocItem ? { description: adhocItem.name, unit_price: String(adhocItem.unit_price) } : undefined}
        onClose={() => { setCustomOpen(false); setAdhocItem(null) }}
        onAdd={(desc, qty, price) => addItem(desc, qty, price, adhocItem ? 'extra' : 'custom')}
      />
    </div>
  )
}

// ─── Compact summary (for checkout modal) ──────────────────────────────────────

export function BookingPricingSummary({ bookingId }: { bookingId: string }) {
  const { business } = useBusinessContext()
  const [items,    setItems]    = useState<LineItem[]>([])
  const [currency, setCurrency] = useState('GBP')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!business) return
    Promise.all([
      supabase.from('booking_line_items').select('id, description, quantity, unit_price, total_price').eq('booking_id', bookingId).order('sort_order'),
      supabase.from('pricing_settings').select('currency_code').eq('business_id', business.id).maybeSingle(),
    ]).then(([liRes, psRes]) => {
      setItems((liRes.data ?? []) as LineItem[])
      if (psRes.data?.currency_code) setCurrency(psRes.data.currency_code)
      setLoading(false)
    })
  }, [bookingId, business])

  if (loading) return <p className="text-xs text-slate-400">Loading…</p>
  if (items.length === 0) return <p className="text-xs text-slate-400 italic">No charges recorded</p>

  const total = items.reduce((s, i) => s + i.total_price, 0)

  return (
    <div className="space-y-1">
      {items.map(item => (
        <div key={item.id} className="flex justify-between gap-3 text-sm">
          <span className="text-slate-700 truncate">{item.description}</span>
          <span className="text-slate-900 font-medium flex-shrink-0">{fmt(item.total_price, currency)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-3 text-sm border-t border-slate-200 pt-2 mt-2">
        <span className="font-semibold text-slate-700">Total</span>
        <span className="font-bold text-slate-900">{fmt(total, currency)}</span>
      </div>
    </div>
  )
}
