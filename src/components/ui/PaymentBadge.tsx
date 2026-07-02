import type { PaymentStatus } from '@/lib/payments'

const CONFIG: Record<Exclude<PaymentStatus, 'unpriced'>, { label: string; classes: string; dot: string }> = {
  'unpaid':       { label: 'Unpaid',       classes: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
  'deposit_paid': { label: 'Deposit paid', classes: 'bg-sky-50 text-sky-700',         dot: 'bg-sky-500' },
  'part_paid':    { label: 'Part-paid',    classes: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500' },
  'paid':         { label: 'Paid',         classes: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  'refunded':     { label: 'Refunded',     classes: 'bg-violet-50 text-violet-700',   dot: 'bg-violet-500' },
}

interface PaymentBadgeProps {
  status: PaymentStatus
  size?: 'sm' | 'md'
}

export default function PaymentBadge({ status, size = 'sm' }: PaymentBadgeProps) {
  if (status === 'unpriced') return null
  const config = CONFIG[status]

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
