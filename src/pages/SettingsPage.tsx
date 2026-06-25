import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Card, PageHeader } from '@/components/ui'
import { useBusinessContext } from '@/context/BusinessContext'
import { PLANS, type PlanId } from '@/lib/plans'

const PLAN_BADGE: Record<PlanId, string> = {
  diary:        'bg-slate-100 text-slate-600',
  professional: 'bg-violet-100 text-violet-700',
  premium:      'bg-amber-100 text-amber-700',
}

const sections = [
  {
    label: 'Business details',
    description: 'Name, address, contact and licence information',
    href: '/settings/business',
  },
  {
    label: 'Branding',
    description: 'Logo, colours and appearance',
    href: '/settings/branding',
  },
  {
    label: 'Staff users',
    description: 'Manage who can access PawBoard',
    href: '/settings/staff',
  },
  {
    label: 'Accommodation',
    description: 'Areas, bookable spaces and capacity rules',
    href: '/settings/accommodation',
  },
  {
    label: 'Species',
    description: 'Configure which species your business boards',
    href: '/settings/species',
  },
  {
    label: 'Vaccination types',
    description: 'Manage required vaccinations and flag which are critical',
    href: '/settings/vaccination-types',
  },
  {
    label: 'Pricing',
    description: 'Rates, sharing discounts and extras catalog',
    href: '/settings/pricing',
  },
  {
    label: 'Payments',
    description: 'Deposits, balances and Stripe settings',
    href: '/settings/payments',
  },
  {
    label: 'Owner portal',
    description: 'Self-service booking and owner account settings',
    href: '/settings/portal',
  },
  {
    label: 'Stay journal',
    description: 'Photo & update log kept during each stay',
    href: '/settings/journal',
  },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { business } = useBusinessContext()
  const planId = (business?.subscription_plan ?? 'diary') as PlanId
  const plan   = PLANS[planId]

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Settings"
        description="Manage your business configuration"
      />

      {/* Subscription plan — always shown at top */}
      <button
        onClick={() => navigate('/settings/plan')}
        className="w-full mb-4 flex items-center justify-between px-5 py-4 text-left rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors group"
      >
        <div>
          <p className="text-sm font-medium text-slate-900">Subscription plan</p>
          <p className="text-xs text-slate-400 mt-0.5">View plan details, compare plans and upgrade</p>
        </div>
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_BADGE[planId]}`}>
            {plan.name.replace('PawBoard ', '')}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
        </div>
      </button>

      <Card padding="none">
        <ul className="divide-y divide-slate-100">
          {sections.map(section => (
            <li key={section.label}>
              <button
                onClick={() => section.href && navigate(section.href)}
                disabled={!section.href}
                className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors first:rounded-t-xl last:rounded-b-xl group disabled:cursor-default enabled:hover:bg-slate-50"
              >
                <div>
                  <p className={['text-sm font-medium', section.href ? 'text-slate-900' : 'text-slate-400'].join(' ')}>
                    {section.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{section.description}</p>
                </div>
                {section.href
                  ? <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0 ml-4" />
                  : <span className="text-xs text-slate-300 ml-4 flex-shrink-0">Coming soon</span>
                }
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
