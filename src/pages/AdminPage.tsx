import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ArrowRight, CheckCircle, PawPrint, Plus, Trash2, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBusinessContext } from '@/context/BusinessContext'
import { Card, Button, Input, Modal } from '@/components/ui'
import { PLANS, type PlanId } from '@/lib/plans'

type BusinessRow = {
  id:                string
  name:              string
  slug:              string
  is_active:         boolean
  subscription_plan: string
  created_at:        string
  city:              string | null
}

type PlanPricingRow = { plan_id: string; price_monthly: number; currency: string }

const PLAN_BADGE: Record<PlanId, string> = {
  diary:        'bg-slate-100 text-slate-500',
  professional: 'bg-violet-100 text-violet-700',
  premium:      'bg-amber-100 text-amber-700',
}

const PLAN_ORDER: PlanId[] = ['diary', 'professional', 'premium']

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

// ─── Create business modal ─────────────────────────────────────────────────────

function CreateBusinessModal({ open, onClose, onCreated }: {
  open:      boolean
  onClose:   () => void
  onCreated: (id: string) => void
}) {
  const [name,   setName]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => { if (open) { setName(''); setError(null); setSaving(false) } }, [open])

  const slug = slugify(name)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug) { setError('Business name is required'); return }
    setSaving(true); setError(null)
    const { data, error: rpcError } = await supabase.rpc('create_business_admin', {
      p_name: name.trim(),
      p_slug: slug,
    })
    if (rpcError) { setError(rpcError.message); setSaving(false); return }
    onCreated(data as string)
  }

  return (
    <Modal open={open} onClose={onClose} title="New business" size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button form="create-biz-form" type="submit" loading={saving}>Create</Button>
      </>}
    >
      <form id="create-biz-form" onSubmit={handleSubmit} className="space-y-3" noValidate>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Input id="biz-name" label="Business name" required autoFocus
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Oakwood Kennels" autoComplete="off" />
        {slug && (
          <p className="text-xs text-slate-400">
            Slug: <span className="font-mono text-slate-600">{slug}</span>
          </p>
        )}
      </form>
    </Modal>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, signOut }            = useAuth()
  const { business, reload }         = useBusinessContext()
  const navigate                     = useNavigate()
  const [businesses,   setBusinesses]  = useState<BusinessRow[]>([])
  const [loading,      setLoading]     = useState(true)
  const [switching,    setSwitching]   = useState<string | null>(null)
  const [deleting,     setDeleting]    = useState<string | null>(null)
  const [confirmDel,   setConfirmDel]  = useState<string | null>(null)
  const [createOpen,   setCreateOpen]  = useState(false)
  const [changingPlan, setChangingPlan]= useState<string | null>(null)
  const [planSaving,   setPlanSaving]  = useState<string | null>(null)
  const [planError,    setPlanError]   = useState<string | null>(null)

  // Plan pricing state
  const [prices,      setPrices]      = useState<Record<PlanId, number>>({
    diary: PLANS.diary.priceMonthly, professional: PLANS.professional.priceMonthly, premium: PLANS.premium.priceMonthly,
  })
  const [priceInputs, setPriceInputs] = useState<Record<PlanId, string>>({
    diary: String(PLANS.diary.priceMonthly), professional: String(PLANS.professional.priceMonthly), premium: String(PLANS.premium.priceMonthly),
  })
  const [priceSaving,  setPriceSaving]  = useState<PlanId | null>(null)
  const [priceSaved,   setPriceSaved]   = useState<PlanId | null>(null)

  const currentId = business?.id

  const load = useCallback(() => {
    setLoading(true)
    supabase.rpc('get_all_businesses_admin').then(({ data }) => {
      setBusinesses((data ?? []) as BusinessRow[])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    load()
    // Load current prices from DB
    supabase.from('plan_pricing').select('plan_id, price_monthly, currency').then(({ data }) => {
      if (data) {
        const next = { ...prices }
        const nextInputs = { ...priceInputs }
        ;(data as PlanPricingRow[]).forEach(row => {
          if (PLAN_ORDER.includes(row.plan_id as PlanId)) {
            next[row.plan_id as PlanId]       = Number(row.price_monthly)
            nextInputs[row.plan_id as PlanId] = String(row.price_monthly)
          }
        })
        setPrices(next)
        setPriceInputs(nextInputs)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  async function switchTo(id: string) {
    setSwitching(id)
    await supabase.rpc('set_admin_view', { target_business_id: id })
    reload()
    navigate('/', { replace: true })
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.rpc('delete_business_admin', { p_business_id: id })
    setConfirmDel(null)
    setDeleting(null)
    if (id === currentId) {
      await supabase.rpc('set_admin_view', { target_business_id: null })
      reload()
    }
    load()
  }

  async function handleSetPlan(bizId: string, planId: PlanId) {
    setPlanSaving(bizId)
    setPlanError(null)
    const { error } = await supabase.rpc('set_business_plan_admin', { p_business_id: bizId, p_plan: planId })
    setPlanSaving(null)
    if (error) {
      setPlanError(error.message)
      return
    }
    setBusinesses(prev => prev.map(b => b.id === bizId ? { ...b, subscription_plan: planId } : b))
    if (bizId === currentId) reload()
    setChangingPlan(null)
  }

  async function handleSavePrice(planId: PlanId) {
    const val = parseFloat(priceInputs[planId])
    if (isNaN(val) || val < 0) return
    setPriceSaving(planId)
    await supabase.rpc('update_plan_pricing', { p_plan_id: planId, p_price: val })
    setPrices(prev => ({ ...prev, [planId]: val }))
    setPriceSaving(null)
    setPriceSaved(planId)
    setTimeout(() => setPriceSaved(null), 3000)
  }

  function handleCreated(id: string) {
    setCreateOpen(false)
    load()
    switchTo(id)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <PawPrint className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">PawBoard</span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
              Platform Admin
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {currentId && (
            <Button size="sm" variant="secondary" onClick={() => navigate('/')}>
              Back to app
            </Button>
          )}
          <span className="text-xs text-slate-400 hidden sm:block">{user?.email}</span>
          <button onClick={signOut} className="text-xs text-slate-400 hover:text-slate-600 underline">
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Businesses</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Create, switch between, or delete tenants.
            </p>
          </div>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
            New business
          </Button>
        </div>

        <Card padding="none">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
          ) : businesses.length === 0 ? (
            <div className="text-center py-10">
              <Building2 className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No businesses yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Create one above, or sign up with a new account.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {businesses.map(biz => {
                const isCurrent     = biz.id === currentId
                const isConfirm     = confirmDel === biz.id
                const isDeleting    = deleting === biz.id
                const isPlanOpen    = changingPlan === biz.id
                const planId        = biz.subscription_plan as PlanId

                return (
                  <li key={biz.id} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                        style={{ backgroundColor: isCurrent ? 'var(--brand-primary, #059669)' : '#94a3b8' }}
                      >
                        {biz.name[0].toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">{biz.name}</p>
                          {!biz.is_active && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">inactive</span>
                          )}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_BADGE[planId] ?? 'bg-slate-100 text-slate-500'}`}>
                            {PLANS[planId]?.name.replace('PawBoard ', '') ?? biz.subscription_plan}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-slate-400 font-mono">{biz.slug}</span>
                          {biz.city && <><span className="text-xs text-slate-300">·</span><span className="text-xs text-slate-400">{biz.city}</span></>}
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-400">
                            {new Date(biz.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      {isConfirm ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-slate-500">Delete all data?</span>
                          <button
                            onClick={() => handleDelete(biz.id)}
                            disabled={isDeleting}
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {isDeleting ? 'Deleting…' : 'Yes, delete'}
                          </button>
                          <button
                            onClick={() => setConfirmDel(null)}
                            className="text-xs font-medium text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setChangingPlan(isPlanOpen ? null : biz.id)}
                            className="text-xs font-medium text-slate-500 hover:text-violet-600 px-2 py-1 rounded-md hover:bg-violet-50 transition-colors"
                          >
                            Change plan
                          </button>
                          {isCurrent ? (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                              <CheckCircle className="w-4 h-4" />
                              Viewing
                            </div>
                          ) : (
                            <Button size="sm" variant="secondary"
                              icon={<ArrowRight className="w-3.5 h-3.5" />}
                              loading={switching === biz.id}
                              onClick={() => switchTo(biz.id)}>
                              Switch to
                            </Button>
                          )}
                          <button
                            onClick={() => setConfirmDel(biz.id)}
                            className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete business"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Inline plan selector */}
                    {isPlanOpen && (
                      <div className="mt-3 pl-[52px] space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-500">Set plan:</span>
                          {PLAN_ORDER.map(pid => (
                            <button
                              key={pid}
                              disabled={!!planSaving}
                              onClick={() => handleSetPlan(biz.id, pid)}
                              className={[
                                'text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60',
                                pid === planId
                                  ? `${PLAN_BADGE[pid]} border-transparent`
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                              ].join(' ')}
                            >
                              {planSaving === biz.id ? 'Saving…' : PLANS[pid].name.replace('PawBoard ', '')}
                            </button>
                          ))}
                          <button
                            onClick={() => { setChangingPlan(null); setPlanError(null) }}
                            className="text-xs text-slate-400 hover:text-slate-600 ml-1"
                          >
                            Cancel
                          </button>
                        </div>
                        {planError && changingPlan === biz.id && (
                          <p className="text-xs text-red-600">{planError}</p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Plan pricing */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 pb-8">
        <div className="flex items-center gap-2 mb-4 mt-2">
          <DollarSign className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">Plan pricing</h2>
          <span className="text-xs text-slate-400">— prices shown on the /settings/plan page</span>
        </div>
        <Card padding="none">
          <ul className="divide-y divide-slate-100">
            {PLAN_ORDER.map(pid => (
              <li key={pid} className="flex items-center gap-4 px-5 py-3.5">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full w-28 text-center flex-shrink-0 ${PLAN_BADGE[pid]}`}>
                  {PLANS[pid].name.replace('PawBoard ', '')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">£</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceInputs[pid]}
                    onChange={e => setPriceInputs(prev => ({ ...prev, [pid]: e.target.value }))}
                    className="w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                  />
                  <span className="text-sm text-slate-400">/month</span>
                </div>
                <button
                  onClick={() => handleSavePrice(pid)}
                  disabled={priceSaving === pid}
                  className="text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50 ml-2"
                >
                  {priceSaving === pid ? 'Saving…' : 'Save'}
                </button>
                {priceSaved === pid && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <CreateBusinessModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
