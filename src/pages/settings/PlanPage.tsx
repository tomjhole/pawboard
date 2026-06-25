import { useState, useEffect } from 'react'
import { Check, X, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card } from '@/components/ui'
import { PLANS, type PlanId } from '@/lib/plans'

// ─── Types ────────────────────────────────────────────────────────────────────

type DbPricing = { plan_id: string; price_monthly: number; currency: string }

type CellValue =
  | { kind: 'bool'; value: boolean }
  | { kind: 'text'; value: string }

type FeatureRow = {
  label:        string
  diary:        CellValue
  professional: CellValue
  premium:      CellValue
}

type FeatureGroup = { heading: string; rows: FeatureRow[] }

// ─── Feature matrix ───────────────────────────────────────────────────────────

const bool = (v: boolean): CellValue => ({ kind: 'bool', value: v })
const text = (v: string):  CellValue => ({ kind: 'text', value: v })

const FEATURES: FeatureGroup[] = [
  {
    heading: 'Usage',
    rows: [
      { label: 'Bookable spaces',      diary: text('5'),    professional: text('30'),        premium: text('Unlimited') },
      { label: 'Accommodation areas',  diary: text('1'),    professional: text('10'),        premium: text('Unlimited') },
      { label: 'Staff user accounts',  diary: text('1'),    professional: text('Unlimited'), premium: text('Unlimited') },
      { label: 'Owner records',        diary: text('150'),  professional: text('Unlimited'), premium: text('Unlimited') },
      { label: 'Custom species',       diary: text('None'), professional: text('2'),         premium: text('Unlimited') },
    ],
  },
  {
    heading: 'Booking & operations',
    rows: [
      { label: 'Booking diary',          diary: bool(true),  professional: bool(true),  premium: bool(true) },
      { label: 'Calendar board',         diary: bool(true),  professional: bool(true),  premium: bool(true) },
      { label: 'Daily operations board', diary: bool(true),  professional: bool(true),  premium: bool(true) },
      { label: 'Vaccination tracking',   diary: bool(true),  professional: bool(true),  premium: bool(true) },
      { label: 'Audit history',          diary: bool(true),  professional: bool(true),  premium: bool(true) },
      { label: 'Calendar filters',       diary: bool(false), professional: bool(true),  premium: bool(true) },
      { label: 'Occupancy view',         diary: bool(false), professional: bool(true),  premium: bool(true) },
      { label: 'Pricing engine',         diary: bool(false), professional: bool(true),  premium: bool(true) },
    ],
  },
  {
    heading: 'Branding',
    rows: [
      { label: 'Logo upload',  diary: bool(true),  professional: bool(true), premium: bool(true) },
      { label: 'Brand colours', diary: bool(false), professional: bool(true), premium: bool(true) },
    ],
  },
  {
    heading: 'Owner experience',
    rows: [
      { label: 'Owner portal',            diary: bool(false), professional: bool(false), premium: bool(true) },
      { label: 'Online booking requests', diary: bool(false), professional: bool(false), premium: bool(true) },
      { label: 'Stay Journal',            diary: bool(false), professional: bool(false), premium: bool(true) },
    ],
  },
  {
    heading: 'Payments & reporting',
    rows: [
      { label: 'Reporting',                  diary: bool(false), professional: bool(true),  premium: bool(true) },
      { label: 'Card payments (Stripe)',     diary: bool(false), professional: bool(false), premium: bool(true) },
      { label: 'Advanced reports & export',  diary: bool(false), professional: bool(false), premium: bool(true) },
    ],
  },
]

// ─── Plan styling ─────────────────────────────────────────────────────────────

const PLAN_STYLE: Record<PlanId, {
  badge: string
  highlight: string
  button: string
}> = {
  diary: {
    badge:     'bg-slate-100 text-slate-600',
    highlight: 'border-slate-300',
    button:    'bg-slate-600 hover:bg-slate-700',
  },
  professional: {
    badge:     'bg-violet-100 text-violet-700',
    highlight: 'border-violet-400 ring-2 ring-violet-200',
    button:    'bg-violet-600 hover:bg-violet-700',
  },
  premium: {
    badge:     'bg-amber-100 text-amber-700',
    highlight: 'border-amber-400 ring-2 ring-amber-200',
    button:    'bg-amber-600 hover:bg-amber-700',
  },
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

function Cell({ value }: { value: CellValue }) {
  if (value.kind === 'bool') {
    return value.value
      ? <Check className="w-4 h-4 text-emerald-500 mx-auto" />
      : <X    className="w-4 h-4 text-slate-200 mx-auto" />
  }
  return <span className="text-sm font-medium text-slate-700">{value.value}</span>
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  planId,
  priceMonthly,
  currency,
  isCurrent,
}: {
  planId:       PlanId
  priceMonthly: number
  currency:     string
  isCurrent:    boolean
}) {
  const plan  = PLANS[planId]
  const style = PLAN_STYLE[planId]
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  return (
    <div className={[
      'relative flex flex-col rounded-2xl border-2 bg-white p-6 transition-shadow',
      isCurrent ? style.highlight : 'border-slate-200',
    ].join(' ')}>
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${style.badge}`}>
            Current plan
          </span>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">{plan.name}</h2>
        <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-extrabold text-slate-900">
          {currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}{priceMonthly}
        </span>
        <span className="text-sm text-slate-400 ml-1">/month</span>
      </div>

      {isCurrent ? (
        <div className={`w-full text-center text-sm font-semibold py-2.5 rounded-xl ${style.badge}`}>
          Your current plan
        </div>
      ) : (
        <>
          <button
            onClick={() => setUpgradeOpen(true)}
            className={`w-full text-white text-sm font-semibold py-2.5 rounded-xl transition-colors ${style.button}`}
          >
            {planId === 'diary' ? 'Downgrade' : 'Upgrade'} to {plan.name.replace('PawBoard ', '')}
          </button>

          {upgradeOpen && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">How to change your plan</p>
              <p>Online plan changes are coming soon with Stripe integration.</p>
              <p>To change your plan now, email <a href="mailto:hello@pawboard.co.uk" className="underline text-violet-600">hello@pawboard.co.uk</a> and we'll get it sorted for you within one business day.</p>
              <button onClick={() => setUpgradeOpen(false)} className="text-slate-400 hover:text-slate-600 mt-1">Dismiss</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ORDERED_PLANS: PlanId[] = ['diary', 'professional', 'premium']

export default function PlanPage() {
  const { business } = useBusinessContext()
  const currentPlan = (business?.subscription_plan ?? 'diary') as PlanId

  const [prices,  setPrices]  = useState<Record<PlanId, { price: number; currency: string }>>({
    diary:        { price: PLANS.diary.priceMonthly,        currency: 'GBP' },
    professional: { price: PLANS.professional.priceMonthly, currency: 'GBP' },
    premium:      { price: PLANS.premium.priceMonthly,      currency: 'GBP' },
  })
  const [loadingPrices, setLoadingPrices] = useState(true)

  useEffect(() => {
    supabase
      .from('plan_pricing')
      .select('plan_id, price_monthly, currency')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const next = { ...prices }
          ;(data as DbPricing[]).forEach(row => {
            if (row.plan_id in next) {
              next[row.plan_id as PlanId] = { price: Number(row.price_monthly), currency: row.currency }
            }
          })
          setPrices(next)
        }
        setLoadingPrices(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Subscription plan"
        description="Compare plans and see what's included"
        backHref="/settings"
      />

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {ORDERED_PLANS.map(planId => (
          <PlanCard
            key={planId}
            planId={planId}
            priceMonthly={loadingPrices ? PLANS[planId].priceMonthly : prices[planId].price}
            currency={prices[planId].currency}
            isCurrent={currentPlan === planId}
          />
        ))}
      </div>

      {/* Feature comparison table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-1/2">
                  Feature
                </th>
                {ORDERED_PLANS.map(planId => (
                  <th key={planId} className="px-4 py-3 text-center w-1/6">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_STYLE[planId].badge}`}>
                      {PLANS[planId].name.replace('PawBoard ', '')}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(group => (
                <>
                  <tr key={group.heading} className="bg-slate-50">
                    <td colSpan={4} className="px-5 py-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        {group.heading}
                      </span>
                    </td>
                  </tr>
                  {group.rows.map(row => (
                    <tr key={row.label} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-2.5 text-sm text-slate-700">{row.label}</td>
                      {(['diary', 'professional', 'premium'] as PlanId[]).map(planId => (
                        <td key={planId} className={[
                          'px-4 py-2.5 text-center',
                          currentPlan === planId ? 'bg-slate-50' : '',
                        ].join(' ')}>
                          <Cell value={row[planId]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

      </Card>

      {/* Upgrade note */}
      <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
        <Zap className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
        <p>
          All prices exclude VAT. Plans are billed monthly and can be changed at any time.
          Online plan changes are coming soon — email{' '}
          <a href="mailto:hello@pawboard.co.uk" className="underline text-violet-600">hello@pawboard.co.uk</a>
          {' '}to upgrade or downgrade.
        </p>
      </div>
    </div>
  )
}
