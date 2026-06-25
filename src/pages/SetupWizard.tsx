import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PawPrint, ArrowRight, ArrowLeft, Building2, Home, BadgePoundSterling,
  PartyPopper, Plus, Trash2, Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { Button, Input } from '@/components/ui'
import type { Database } from '@/types/database'

type Species = Database['public']['Tables']['species']['Row']
type PetSize = Database['public']['Enums']['pet_size']

type Area = {
  id: string
  name: string
  accommodation_area_species: { species_id: string }[]
}

const SIZE_OPTIONS: { value: PetSize; label: string }[] = [
  { value: 'toy', label: 'Toy' }, { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }, { value: 'giant', label: 'Giant' },
]

const STEPS = ['welcome', 'business', 'areas', 'spaces', 'pricing', 'done'] as const
type StepId = typeof STEPS[number]
const PROGRESS: { id: StepId; label: string }[] = [
  { id: 'business', label: 'Business' },
  { id: 'areas',    label: 'Areas' },
  { id: 'spaces',   label: 'Spaces' },
  { id: 'pricing',  label: 'Pricing' },
]

export default function SetupWizard() {
  const { business, reload } = useBusinessContext()
  const navigate = useNavigate()

  const [step, setStep]       = useState<StepId>('welcome')
  const [species, setSpecies] = useState<Species[]>([])
  const [areas, setAreas]     = useState<Area[]>([])
  const [spaceCounts, setSpaceCounts] = useState<Record<string, number>>({})

  const loadSpecies = useCallback(async () => {
    const { data } = await supabase.from('species').select('*')
      .eq('is_active', true)
      .order('is_system_default', { ascending: false }).order('sort_order').order('name')
    setSpecies(data ?? [])
  }, [])

  const loadAreas = useCallback(async () => {
    const { data } = await supabase.from('accommodation_areas')
      .select('id, name, accommodation_area_species ( species_id )')
      .order('sort_order').order('name')
    setAreas((data ?? []) as Area[])
  }, [])

  const loadSpaceCounts = useCallback(async () => {
    const { data } = await supabase.from('accommodation_spaces').select('id, area_id')
    const counts: Record<string, number> = {}
    for (const s of (data ?? []) as { area_id: string }[]) counts[s.area_id] = (counts[s.area_id] ?? 0) + 1
    setSpaceCounts(counts)
  }, [])

  useEffect(() => { loadSpecies(); loadAreas(); loadSpaceCounts() }, [loadSpecies, loadAreas, loadSpaceCounts])

  async function markComplete() {
    if (!business) return
    await supabase.from('business_settings').upsert(
      { business_id: business.id, setup_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'business_id' },
    )
    reload()
  }

  async function finish() {
    await markComplete()
    navigate('/calendar', { replace: true })
  }

  const idx = STEPS.indexOf(step)
  function go(to: StepId) { setStep(to) }
  function next() { if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]) }
  function back() { if (idx > 0) setStep(STEPS[idx - 1]) }

  if (!business) return null

  const totalSpaces = Object.values(spaceCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--brand-primary)' }}>
              <PawPrint className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900">PawBoard setup</span>
          </div>
          <button onClick={finish} className="text-sm text-slate-400 hover:text-slate-600">
            {step === 'done' ? '' : 'Finish later'}
          </button>
        </div>
        {/* Progress */}
        {step !== 'welcome' && step !== 'done' && (
          <div className="max-w-2xl mx-auto px-4 pb-3 flex items-center gap-2">
            {PROGRESS.map((p, i) => {
              const pIdx = STEPS.indexOf(p.id)
              const done = pIdx < idx
              const active = p.id === step
              return (
                <div key={p.id} className="flex items-center gap-2 flex-1">
                  <button onClick={() => go(p.id)}
                    className={[
                      'flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
                      active ? '' : done ? 'text-slate-500' : 'text-slate-300',
                    ].join(' ')}
                    style={active ? { color: 'var(--brand-primary)' } : {}}>
                    <span className={[
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] border',
                      done ? 'text-white border-transparent' : active ? 'border-current' : 'border-slate-200',
                    ].join(' ')} style={done ? { backgroundColor: 'var(--brand-primary)' } : active ? { color: 'var(--brand-primary)' } : {}}>
                      {done ? <Check className="w-3 h-3" /> : i + 1}
                    </span>
                    {p.label}
                  </button>
                  {i < PROGRESS.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
                </div>
              )
            })}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        {step === 'welcome'  && <WelcomeStep onStart={next} onSkip={finish} businessName={business.name} />}
        {step === 'business' && <BusinessStep businessId={business.id} onBack={back} onNext={next} />}
        {step === 'areas'    && <AreasStep businessId={business.id} species={species} areas={areas} onReload={loadAreas} onBack={back} onNext={next} />}
        {step === 'spaces'   && <SpacesStep businessId={business.id} species={species} areas={areas} counts={spaceCounts} onReload={loadSpaceCounts} onBack={back} onNext={next} />}
        {step === 'pricing'  && <PricingStep businessId={business.id} species={species} areas={areas} onBack={back} onNext={next} />}
        {step === 'done'     && <DoneStep areaCount={areas.length} spaceCount={totalSpaces} onFinish={finish} />}
      </main>
    </div>
  )
}

// ─── Step shell ──────────────────────────────────────────────────────────────

function StepCard({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      </div>
      <p className="text-sm text-slate-500 mb-5 ml-12">{description}</p>
      {children}
    </div>
  )
}

function Nav({ onBack, onNext, nextLabel = 'Continue', nextDisabled, skip }: {
  onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; skip?: () => void
}) {
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
      {onBack ? (
        <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>Back</Button>
      ) : <span />}
      <div className="flex items-center gap-2">
        {skip && <Button variant="ghost" onClick={skip}>Skip for now</Button>}
        <Button onClick={onNext} disabled={nextDisabled} icon={<ArrowRight className="w-4 h-4" />}>{nextLabel}</Button>
      </div>
    </div>
  )
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

function WelcomeStep({ onStart, onSkip, businessName }: { onStart: () => void; onSkip: () => void; businessName: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--brand-primary)' }}>
        <PawPrint className="w-6 h-6 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Welcome to PawBoard 🐾</h1>
      <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
        Let's get <span className="font-medium text-slate-700">{businessName}</span> ready to take bookings. It takes about 3 minutes — we'll set up your
        accommodation and pricing so the calendar's ready to go.
      </p>
      <ul className="text-sm text-slate-600 mt-5 space-y-2 max-w-xs mx-auto text-left">
        {['Your business details', 'Accommodation areas', 'Bookable kennels & pens', 'Pricing (optional)'].map(t => (
          <li key={t} className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 12%, white)' }}>
              <Check className="w-3 h-3" style={{ color: 'var(--brand-primary)' }} />
            </span>
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-7 flex flex-col items-center gap-2">
        <Button size="lg" onClick={onStart} icon={<ArrowRight className="w-4 h-4" />}>Get started</Button>
        <button onClick={onSkip} className="text-sm text-slate-400 hover:text-slate-600">I'll explore on my own</button>
      </div>
    </div>
  )
}

// ─── Business details ────────────────────────────────────────────────────────

function BusinessStep({ businessId, onBack, onNext }: { businessId: string; onBack: () => void; onNext: () => void }) {
  const [f, setF] = useState({ phone: '', email: '', address_line1: '', city: '', postcode: '', licence_number: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('businesses').select('phone, email, address_line1, city, postcode, licence_number').eq('id', businessId).maybeSingle()
      .then(({ data }) => { if (data) setF({
        phone: data.phone ?? '', email: data.email ?? '', address_line1: data.address_line1 ?? '',
        city: data.city ?? '', postcode: data.postcode ?? '', licence_number: data.licence_number ?? '',
      }) })
  }, [businessId])

  async function saveAndNext() {
    setSaving(true)
    await supabase.from('businesses').update({
      phone: f.phone.trim() || null, email: f.email.trim() || null,
      address_line1: f.address_line1.trim() || null, city: f.city.trim() || null,
      postcode: f.postcode.trim() || null, licence_number: f.licence_number.trim() || null,
    }).eq('id', businessId)
    setSaving(false)
    onNext()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <StepCard icon={Building2} title="Your business" description="Contact details that appear on receipts and confirmations. You can change these any time.">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="b-phone" label="Phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="01234 567890" />
            <Input id="b-email" label="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="hello@yourkennels.co.uk" />
          </div>
          <Input id="b-addr" label="Address" value={f.address_line1} onChange={e => setF({ ...f, address_line1: e.target.value })} placeholder="Street address" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="b-city" label="Town / City" value={f.city} onChange={e => setF({ ...f, city: e.target.value })} />
            <Input id="b-pc" label="Postcode" value={f.postcode} onChange={e => setF({ ...f, postcode: e.target.value })} />
          </div>
          <Input id="b-lic" label="Licence number (optional)" value={f.licence_number} onChange={e => setF({ ...f, licence_number: e.target.value })} placeholder="Council boarding licence" />
        </div>
      </StepCard>
      <Nav onBack={onBack} onNext={saveAndNext} nextLabel={saving ? 'Saving…' : 'Continue'} skip={onNext} />
    </div>
  )
}

// ─── Areas ───────────────────────────────────────────────────────────────────

function speciesByKind(species: Species[], wantPlural: 'dog' | 'cat'): string[] {
  return species.filter(s => s.name.toLowerCase().startsWith(wantPlural)).map(s => s.id)
}

function AreasStep({ businessId, species, areas, onReload, onBack, onNext }: {
  businessId: string; species: Species[]; areas: Area[]; onReload: () => Promise<void>; onBack: () => void; onNext: () => void
}) {
  const [name, setName]   = useState('')
  const [sel, setSel]     = useState<string[]>([])
  const [busy, setBusy]   = useState(false)
  const speciesMap = Object.fromEntries(species.map(s => [s.id, s]))

  function toggle(id: string) { setSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]) }
  function preset(n: string, ids: string[]) { setName(n); setSel(ids) }

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    const { data, error } = await supabase.from('accommodation_areas')
      .insert({ business_id: businessId, name: name.trim(), is_active: true, sort_order: areas.length })
      .select('id').single()
    if (!error && data && sel.length > 0) {
      await supabase.from('accommodation_area_species')
        .insert(sel.map(sid => ({ area_id: data.id, species_id: sid, business_id: businessId })))
    }
    setName(''); setSel([])
    await onReload()
    setBusy(false)
  }

  async function remove(id: string) {
    await supabase.from('accommodation_areas').delete().eq('id', id)
    await onReload()
  }

  const dogIds = speciesByKind(species, 'dog')
  const catIds = speciesByKind(species, 'cat')

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <StepCard icon={Building2} title="Accommodation areas"
        description="Group your site into areas — e.g. a dog block and a cattery. You'll add the individual kennels next.">
        {/* Existing areas */}
        {areas.length > 0 && (
          <ul className="space-y-2 mb-4">
            {areas.map(a => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200">
                <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-900 flex-1">{a.name}</span>
                <div className="flex gap-1">
                  {a.accommodation_area_species.map(r => speciesMap[r.species_id]).filter(Boolean).map(s => (
                    <span key={s!.id} className="text-xs">{s!.icon}</span>
                  ))}
                </div>
                <button onClick={() => remove(a.id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </li>
            ))}
          </ul>
        )}

        {/* Add form */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="flex flex-wrap gap-2">
            {dogIds.length > 0 && <button onClick={() => preset('Dog Block', dogIds)} className="text-xs px-2.5 py-1 rounded-full border border-slate-300 bg-white hover:border-slate-400">🐕 Dog block</button>}
            {catIds.length > 0 && <button onClick={() => preset('Cattery', catIds)} className="text-xs px-2.5 py-1 rounded-full border border-slate-300 bg-white hover:border-slate-400">🐈 Cattery</button>}
          </div>
          <Input id="area-name" label="Area name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dog Block A" />
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Animals kept here</p>
            <div className="flex flex-wrap gap-2">
              {species.map(s => {
                const on = sel.includes(s.id)
                return (
                  <button key={s.id} type="button" onClick={() => toggle(s.id)}
                    className={['inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors', on ? 'border-transparent text-white' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'].join(' ')}
                    style={on ? { backgroundColor: s.colour ?? 'var(--brand-primary)', borderColor: s.colour ?? 'var(--brand-primary)' } : {}}>
                    {s.icon && <span>{s.icon}</span>}{s.name}
                  </button>
                )
              })}
            </div>
          </div>
          <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={add} loading={busy} disabled={!name.trim()}>
            Add area
          </Button>
        </div>
      </StepCard>
      <Nav onBack={onBack} onNext={onNext} nextDisabled={areas.length === 0} />
      {areas.length === 0 && <p className="text-xs text-slate-400 text-right mt-1">Add at least one area to continue.</p>}
    </div>
  )
}

// ─── Spaces ──────────────────────────────────────────────────────────────────

function SpacesStep({ businessId, species, areas, counts, onReload, onBack, onNext }: {
  businessId: string; species: Species[]; areas: Area[]; counts: Record<string, number>; onReload: () => Promise<void>; onBack: () => void; onNext: () => void
}) {
  const speciesMap = Object.fromEntries(species.map(s => [s.id, s]))
  const [areaId, setAreaId]   = useState(areas[0]?.id ?? '')
  const [prefix, setPrefix]   = useState('Kennel')
  const [count, setCount]     = useState('10')
  const [maxPets, setMaxPets] = useState('1')
  const [sizes, setSizes]     = useState<PetSize[]>([])
  const [busy, setBusy]       = useState(false)

  const area = areas.find(a => a.id === areaId)
  // Sensible default prefix from the area's species
  useEffect(() => {
    if (!area) return
    const sids = area.accommodation_area_species.map(r => r.species_id)
    const isCat = sids.some(id => speciesMap[id]?.name.toLowerCase().startsWith('cat'))
    setPrefix(isCat ? 'Cabin' : 'Kennel')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId])

  function toggleSize(s: PetSize) { setSizes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]) }

  async function add() {
    if (!area) return
    const n = Math.min(100, Math.max(1, parseInt(count) || 0))
    if (n < 1) return
    setBusy(true)
    const start = (counts[areaId] ?? 0) + 1
    const rows = Array.from({ length: n }, (_, i) => ({
      business_id: businessId, area_id: areaId, name: `${prefix.trim()} ${start + i}`,
      max_pets: Math.max(1, parseInt(maxPets) || 1), same_household_only: true, requires_staff_approval: false,
      allowed_pet_sizes: sizes.length > 0 ? sizes : null, is_active: true, sort_order: start - 1 + i,
    }))
    const { data: created, error } = await supabase.from('accommodation_spaces').insert(rows).select('id')
    const areaSpecies = area.accommodation_area_species.map(r => r.species_id)
    if (!error && created && areaSpecies.length > 0) {
      await supabase.from('accommodation_space_species').insert(
        created.flatMap(sp => areaSpecies.map(species_id => ({ space_id: sp.id, species_id, business_id: businessId }))),
      )
    }
    await onReload()
    setBusy(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <StepCard icon={Home} title="Bookable spaces"
        description="Add your kennels, pens or cabins in bulk. We'll number them for you.">
        {/* Counts per area */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {areas.map(a => (
            <div key={a.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-xs text-slate-500 truncate">{a.name}</p>
              <p className="text-lg font-bold text-slate-900">{counts[a.id] ?? 0} <span className="text-xs font-normal text-slate-400">spaces</span></p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="space-y-1.5">
            <label htmlFor="sp-area" className="block text-sm font-medium text-slate-700">Area</label>
            <select id="sp-area" value={areaId} onChange={e => setAreaId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-primary)]">
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input id="sp-prefix" label="Name prefix" value={prefix} onChange={e => setPrefix(e.target.value)} />
            <Input id="sp-count" label="How many" type="number" min="1" max="100" value={count} onChange={e => setCount(e.target.value)} />
            <Input id="sp-max" label="Max pets each" type="number" min="1" max="10" value={maxPets} onChange={e => setMaxPets(e.target.value)} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Sizes allowed <span className="text-slate-400 font-normal">(optional — leave blank for any)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {SIZE_OPTIONS.map(s => {
                const on = sizes.includes(s.value)
                return (
                  <button key={s.value} type="button" onClick={() => toggleSize(s.value)}
                    className={['px-2.5 py-1 rounded-full text-xs border transition-colors', on ? 'border-transparent text-white' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'].join(' ')}
                    style={on ? { backgroundColor: 'var(--brand-primary)' } : {}}>{s.label}</button>
                )
              })}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Creates <span className="font-medium">{prefix} {(counts[areaId] ?? 0) + 1}</span> … <span className="font-medium">{prefix} {(counts[areaId] ?? 0) + (parseInt(count) || 0)}</span>
          </p>
          <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={add} loading={busy} disabled={!areaId}>
            Add spaces
          </Button>
        </div>
      </StepCard>
      <Nav onBack={onBack} onNext={onNext} skip={onNext} />
    </div>
  )
}

// ─── Pricing (optional) ──────────────────────────────────────────────────────

function PricingStep({ businessId, species, areas, onBack, onNext }: {
  businessId: string; species: Species[]; areas: Area[]; onBack: () => void; onNext: () => void
}) {
  // species used across the areas (fallback to all)
  const used = new Set(areas.flatMap(a => a.accommodation_area_species.map(r => r.species_id)))
  const boarded = species.filter(s => used.size === 0 || used.has(s.id))

  const [rates, setRates] = useState<Record<string, string>>({})
  const [busy, setBusy]   = useState(false)

  async function saveAndNext() {
    const entries = boarded
      .map(s => ({ id: s.id, name: s.name, price: parseFloat(rates[s.id] ?? '') }))
      .filter(e => !isNaN(e.price) && e.price > 0)
    if (entries.length > 0) {
      setBusy(true)
      await supabase.from('pricing_settings').upsert(
        { business_id: businessId, calculation_method: 'nightly', currency_code: 'GBP' },
        { onConflict: 'business_id' },
      )
      await supabase.from('pricing_rates').insert(entries.map((e, i) => ({
        business_id: businessId, area_id: null, species_id: e.id, pet_size: null,
        unit_price: e.price, label: `${e.name} (per night)`, sort_order: i, is_active: true,
      })))
      setBusy(false)
    }
    onNext()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <StepCard icon={BadgePoundSterling} title="Pricing" description="Set a starting nightly rate per animal. You can build a detailed rate card later — this just gets you going.">
        {boarded.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Add areas first to set rates, or skip this for now.</p>
        ) : (
          <div className="space-y-2.5">
            {boarded.map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-sm text-slate-700 flex-1">{s.icon} {s.name} — per night</span>
                <div className="w-32">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">£</span>
                    <input type="number" min="0" step="0.01" value={rates[s.id] ?? ''} onChange={e => setRates(p => ({ ...p, [s.id]: e.target.value }))}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-primary)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </StepCard>
      <Nav onBack={onBack} onNext={saveAndNext} nextLabel={busy ? 'Saving…' : 'Continue'} skip={onNext} />
    </div>
  )
}

// ─── Done ────────────────────────────────────────────────────────────────────

function DoneStep({ areaCount, spaceCount, onFinish }: { areaCount: number; spaceCount: number; onFinish: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
        <PartyPopper className="w-7 h-7 text-emerald-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">You're all set!</h1>
      <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
        {spaceCount > 0
          ? <>You've set up <span className="font-medium text-slate-700">{spaceCount} space{spaceCount === 1 ? '' : 's'}</span> across <span className="font-medium text-slate-700">{areaCount} area{areaCount === 1 ? '' : 's'}</span>. Your calendar is ready for bookings.</>
          : <>Your business is ready. You can add accommodation any time from Settings.</>}
      </p>
      <div className="mt-4 text-xs text-slate-400 max-w-sm mx-auto">
        Next steps you might want: add owners &amp; pets, invite staff, or fine-tune pricing — all from the menu.
      </div>
      <div className="mt-7">
        <Button size="lg" onClick={onFinish} icon={<ArrowRight className="w-4 h-4" />}>Go to PawBoard</Button>
      </div>
    </div>
  )
}
