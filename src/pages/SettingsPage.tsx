import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Card, PageHeader } from '@/components/ui'

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
    href: null,
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
    label: 'Payments',
    description: 'Deposits, balances and Stripe settings',
    href: null,
  },
  {
    label: 'Owner portal',
    description: 'Self-service booking and owner account settings',
    href: null,
  },
  {
    label: 'Notifications',
    description: 'Email reminders and alerts',
    href: null,
  },
]

export default function SettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Settings"
        description="Manage your business configuration"
      />
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
