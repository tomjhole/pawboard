import type { ReactNode } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui'
import { downloadCsv, type DateRange } from '@/lib/reports'

export type ReportProps = {
  range:     DateRange
  currency:  string
  canExport: boolean   // true on premium — shows CSV export
}

// ─── Report frame ────────────────────────────────────────────────────────────

export function ReportFrame({ title, description, note, actions, children }: {
  title: string
  description?: string
  note?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
        </div>
        {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
      {note && <p className="text-xs text-slate-400 mb-3">{note}</p>}
      {children}
    </div>
  )
}

// ─── Export button (gated to premium by the caller) ──────────────────────────

export function ExportButton({ filename, headers, rows, enabled, disabled }: {
  filename: string
  headers: string[]
  rows: (string | number)[][]
  enabled: boolean              // plan allows export
  disabled?: boolean            // no data
}) {
  if (!enabled) return null
  return (
    <Button
      size="sm" variant="secondary"
      icon={<Download className="w-3.5 h-3.5" />}
      disabled={disabled || rows.length === 0}
      onClick={() => downloadCsv(filename, headers, rows)}
    >
      Export CSV
    </Button>
  )
}

// ─── Metric tiles ────────────────────────────────────────────────────────────

export function MetricRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">{children}</div>
}

export function Metric({ label, value, sub, tone }: {
  label: string
  value: string | number
  sub?: string
  tone?: 'default' | 'positive' | 'warning' | 'negative'
}) {
  const toneCls = {
    default:  'text-slate-900',
    positive: 'text-emerald-600',
    warning:  'text-amber-600',
    negative: 'text-rose-600',
  }[tone ?? 'default']
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${toneCls}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Bar (inline, dependency-free) ───────────────────────────────────────────

export function Bar({ value, max, colour }: { value: number; max: number; colour?: string }) {
  const w = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: colour ?? 'var(--brand-primary)' }} />
    </div>
  )
}

/** Vertical bar chart for trends — pure SVG/flex, no chart lib. */
export function MiniBarChart({ data, valueFmt }: {
  data: { label: string; value: number; caption?: string }[]
  valueFmt?: (v: number) => string
}) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="flex items-end gap-2 h-44 px-1">
      {data.map((d, i) => {
        const h = Math.round((d.value / max) * 100)
        return (
          <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
            <span className="text-[10px] font-medium text-slate-500 mb-1">
              {valueFmt ? valueFmt(d.value) : d.value}
            </span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{ height: `${Math.max(2, h)}%`, backgroundColor: 'var(--brand-primary)' }}
              title={`${d.label}: ${valueFmt ? valueFmt(d.value) : d.value}`}
            />
            <span className="text-[10px] text-slate-400 mt-1 truncate w-full text-center">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Table ───────────────────────────────────────────────────────────────────

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

export function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide text-${align} bg-slate-50/60 border-b border-slate-100 whitespace-nowrap`}>
      {children}
    </th>
  )
}

export function Td({ children, align = 'left', strong }: { children: ReactNode; align?: 'left' | 'right' | 'center'; strong?: boolean }) {
  return (
    <td className={`px-4 py-2.5 text-${align} ${strong ? 'font-semibold text-slate-900' : 'text-slate-700'} border-b border-slate-50 last:border-b-0`}>
      {children}
    </td>
  )
}

// ─── States ──────────────────────────────────────────────────────────────────

export function ReportLoading() {
  return <p className="text-sm text-slate-400 py-12 text-center">Crunching the numbers…</p>
}

export function ReportEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center">
      <p className="text-sm text-slate-400 italic">{message}</p>
    </div>
  )
}
