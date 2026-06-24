import type { Database } from '@/types/database'

export type DbBookingStatus = Database['public']['Enums']['booking_status']

export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function fmtDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function nights(start: string, end: string): number {
  return Math.max(0, Math.round(
    (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000,
  ))
}

// Owner-friendly status (hides internal staff jargon)
type PillConfig = { label: string; cls: string }

const STATUS_PILL: Record<DbBookingStatus, PillConfig> = {
  enquiry:             { label: 'Requested',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  waiting_list:        { label: 'Waiting list', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  confirmed:           { label: 'Confirmed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  details_outstanding: { label: 'Confirmed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ready:               { label: 'Confirmed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  checked_in:          { label: 'Staying now', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  due_out:             { label: 'Leaving today', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  checked_out:         { label: 'Completed',   cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  cancelled:           { label: 'Cancelled',   cls: 'bg-rose-50 text-rose-500 border-rose-200' },
}

export function StatusPill({ status }: { status: DbBookingStatus }) {
  const c = STATUS_PILL[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.cls}`}>
      {c.label}
    </span>
  )
}
