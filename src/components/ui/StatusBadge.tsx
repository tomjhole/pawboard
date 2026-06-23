export type BookingStatus =
  | 'enquiry'
  | 'provisional'
  | 'confirmed'
  | 'details-outstanding'
  | 'ready'
  | 'checked-in'
  | 'due-out'
  | 'checked-out'
  | 'cancelled'
  | 'needs-attention'
  | 'waiting-list'

interface StatusConfig {
  label: string
  classes: string
  dot: string
}

const statusConfig: Record<BookingStatus, StatusConfig> = {
  'enquiry':             { label: 'Enquiry',             classes: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400' },
  'provisional':         { label: 'Provisional',         classes: 'bg-blue-50 text-blue-700',        dot: 'bg-blue-400' },
  'confirmed':           { label: 'Confirmed',           classes: 'bg-emerald-50 text-emerald-700',  dot: 'bg-emerald-500' },
  'details-outstanding': { label: 'Details outstanding', classes: 'bg-amber-50 text-amber-700',      dot: 'bg-amber-500' },
  'ready':               { label: 'Ready for arrival',   classes: 'bg-teal-50 text-teal-700',        dot: 'bg-teal-500' },
  'checked-in':          { label: 'Checked in',          classes: 'bg-green-50 text-green-800',      dot: 'bg-green-500' },
  'due-out':             { label: 'Due out today',        classes: 'bg-orange-50 text-orange-700',   dot: 'bg-orange-500' },
  'checked-out':         { label: 'Checked out',         classes: 'bg-slate-100 text-slate-500',     dot: 'bg-slate-400' },
  'cancelled':           { label: 'Cancelled',           classes: 'bg-rose-50 text-rose-500',        dot: 'bg-rose-400' },
  'needs-attention':     { label: 'Needs attention',     classes: 'bg-red-50 text-red-700',          dot: 'bg-red-500' },
  'waiting-list':        { label: 'Waiting list',        classes: 'bg-purple-50 text-purple-700',    dot: 'bg-purple-400' },
}

interface StatusBadgeProps {
  status: BookingStatus
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        config.classes,
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  )
}
