import { useState } from 'react'
import type { ComponentType } from 'react'
import { Lock, Download } from 'lucide-react'
import { PageHeader, Card, PlanGate } from '@/components/ui'
import { useBusinessContext } from '@/context/BusinessContext'
import { canAccessSettings } from '@/lib/roles'
import { usePlan } from '@/lib/plans'
import {
  PRESETS, presetRange, type PresetId, type DateRange,
} from '@/lib/reports'
import type { ReportProps } from './parts'
import { OccupancyByDate, OccupancyBySpecies, OccupancyTrends } from './occupancy'
import { ArrivalsDepartures, Cancellations } from './movements'
import { RevenueSummary, OutstandingBalances, RevenueBySpaceType } from './revenue'
import { VaccinationIssues } from './vaccinations'
import { RepeatCustomers } from './customers'

type Tier = 'professional' | 'premium'
// `money` reports expose revenue/balances → restricted to owner/manager
type ReportDef = { id: string; label: string; tier: Tier; money?: boolean; Component: ComponentType<ReportProps> }

const REPORTS: ReportDef[] = [
  { id: 'occupancy-date',    label: 'Occupancy by date',    tier: 'professional', Component: OccupancyByDate },
  { id: 'occupancy-species', label: 'Occupancy by species', tier: 'professional', Component: OccupancyBySpecies },
  { id: 'arrivals',          label: 'Arrivals & departures', tier: 'professional', Component: ArrivalsDepartures },
  { id: 'revenue',           label: 'Revenue summary',      tier: 'professional', money: true, Component: RevenueSummary },
  { id: 'outstanding',       label: 'Outstanding balances', tier: 'professional', money: true, Component: OutstandingBalances },
  { id: 'vaccinations',      label: 'Vaccination issues',   tier: 'professional', Component: VaccinationIssues },
  { id: 'occupancy-trends',  label: 'Occupancy trends',     tier: 'premium',      Component: OccupancyTrends },
  { id: 'revenue-space',     label: 'Revenue by space type', tier: 'premium',     money: true, Component: RevenueBySpaceType },
  { id: 'repeat',            label: 'Repeat customers',     tier: 'premium',      Component: RepeatCustomers },
  { id: 'cancellations',     label: 'Cancellations',        tier: 'premium',      Component: Cancellations },
]

export default function ReportsPage() {
  const { settings, staffUser, isAdmin } = useBusinessContext()
  const { atLeast, can } = usePlan()
  const currency   = settings?.currency ?? 'GBP'
  const hasPro     = atLeast('professional')
  const hasPremium = can('advancedReporting')
  // Revenue/balance reports are owner/manager-only (platform admins always pass)
  const canMoney   = isAdmin || (staffUser ? canAccessSettings(staffUser.role) : false)
  const visible    = (r: ReportDef) => !r.money || canMoney

  const [preset, setPreset] = useState<PresetId>('this_month')
  const [range,  setRange]  = useState<DateRange>(() => presetRange('this_month'))
  const [selected, setSelected] = useState<string>('occupancy-date')

  function choosePreset(id: PresetId) {
    setPreset(id)
    if (id !== 'custom') setRange(presetRange(id))
  }

  // Diary plan — reporting not available at all
  if (!hasPro) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Reports" description="Occupancy, revenue and customer insights" />
        <PlanGate feature="Reporting" requiredPlan="PawBoard Professional" />
        <Card className="mt-4">
          <p className="text-sm text-slate-600 mb-3">Reporting gives you a clear picture of how the business is doing:</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm text-slate-500">
            {REPORTS.map(r => (
              <li key={r.id} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                {r.label}
                {r.tier === 'premium' && <span className="text-[10px] font-semibold text-amber-600 uppercase">Premium</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  const def    = REPORTS.find(r => r.id === selected) ?? REPORTS[0]
  const locked = def.tier === 'premium' && !hasPremium
  const restrictedByRole = !!def.money && !canMoney

  const proReports     = REPORTS.filter(r => r.tier === 'professional' && visible(r))
  const premiumReports = REPORTS.filter(r => r.tier === 'premium' && visible(r))

  function ReportPills({ list }: { list: ReportDef[] }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {list.map(r => {
          const isLocked = r.tier === 'premium' && !hasPremium
          const active = r.id === selected
          return (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                active
                  ? 'border-transparent text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900',
              ].join(' ')}
              style={active ? { backgroundColor: 'var(--brand-primary)' } : {}}
            >
              {isLocked && <Lock className="w-3 h-3 flex-shrink-0 opacity-70" />}
              {r.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="Reports" description="Occupancy, revenue and customer insights" />

      {/* Date range */}
      <Card className="mb-4" padding="sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">Period</span>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => choosePreset(p.id)}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                preset === p.id
                  ? 'border-transparent text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
              ].join(' ')}
              style={preset === p.id ? { backgroundColor: 'var(--brand-primary)' } : {}}
            >
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-1">
              <input type="date" value={range.from} max={range.to}
                onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
                className="px-2 py-1 text-xs border border-slate-300 rounded-md" />
              <span className="text-slate-400 text-xs">to</span>
              <input type="date" value={range.to} min={range.from}
                onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
                className="px-2 py-1 text-xs border border-slate-300 rounded-md" />
            </div>
          )}
        </div>
      </Card>

      {/* Report chooser */}
      <div className="space-y-3 mb-6">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Professional</p>
          <ReportPills list={proReports} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Premium</p>
            {hasPremium && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <Download className="w-3 h-3" /> CSV export on every report
              </span>
            )}
          </div>
          <ReportPills list={premiumReports} />
        </div>
      </div>

      {/* Selected report */}
      {restrictedByRole ? (
        <Card>
          <p className="text-sm text-slate-600">
            <span className="font-medium">{def.label}</span> is only available to owners and managers.
          </p>
        </Card>
      ) : locked ? (
        <PlanGate feature={def.label} requiredPlan="PawBoard Premium" />
      ) : (
        <def.Component range={range} currency={currency} canExport={hasPremium} />
      )}
    </div>
  )
}
