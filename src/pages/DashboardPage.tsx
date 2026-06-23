import { Link } from 'react-router-dom'
import { Card, PageHeader, StatusBadge } from '@/components/ui'

const statCards = [
  { label: 'Checked in',       value: '—', sub: 'pets currently boarding' },
  { label: 'Arriving today',   value: '—', sub: 'due to check in' },
  { label: 'Leaving today',    value: '—', sub: 'due to check out' },
  { label: 'Available spaces', value: '—', sub: 'across all areas' },
]

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Good morning"
        description="Here is what is happening today."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(card => (
          <Card key={card.label} padding="md">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1 mb-0.5">{card.value}</p>
            <p className="text-xs text-slate-400">{card.sub}</p>
          </Card>
        ))}
      </div>

      <Card padding="lg">
        <p className="text-sm font-medium text-slate-700 mb-4">Status key</p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="enquiry" />
          <StatusBadge status="provisional" />
          <StatusBadge status="confirmed" />
          <StatusBadge status="details-outstanding" />
          <StatusBadge status="ready" />
          <StatusBadge status="checked-in" />
          <StatusBadge status="due-out" />
          <StatusBadge status="checked-out" />
          <StatusBadge status="needs-attention" />
          <StatusBadge status="waiting-list" />
          <StatusBadge status="cancelled" />
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Daily overview, arrivals and departures will appear here.{' '}
          <Link to="/calendar" className="text-emerald-600 hover:underline">Go to Calendar</Link>{' '}
          to view the booking diary.
        </p>
      </Card>
    </div>
  )
}
