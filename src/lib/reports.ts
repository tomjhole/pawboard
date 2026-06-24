// Shared helpers for the reporting module.

export type DateRange = { from: string; to: string }  // inclusive ISO dates (yyyy-mm-dd)

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayIso(): string {
  return isoDate(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

/** Every ISO date from `from` to `to` inclusive. Capped to avoid runaway ranges. */
export function eachDay(from: string, to: string, cap = 400): string[] {
  const out: string[] = []
  let cur = from
  while (cur <= to && out.length < cap) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

/** Inclusive-date overlap: does [aStart,aEnd] intersect [bStart,bEnd]? */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export function nightsBetween(start: string, end: string): number {
  return Math.max(0, Math.round(
    (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000,
  ))
}

export function fmtMoney(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
}

export function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function pct(n: number, of: number): number {
  return of <= 0 ? 0 : Math.round((n / of) * 100)
}

// ─── Date range presets ─────────────────────────────────────────────────────

export type PresetId = 'this_month' | 'last_month' | 'last_30' | 'next_30' | 'this_year' | 'custom'

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_30',    label: 'Last 30 days' },
  { id: 'next_30',    label: 'Next 30 days' },
  { id: 'this_year',  label: 'This year' },
  { id: 'custom',     label: 'Custom' },
]

export function presetRange(id: PresetId, today = new Date()): DateRange {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (id) {
    case 'this_month':
      return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) }
    case 'last_month':
      return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) }
    case 'last_30':
      return { from: addDays(isoDate(today), -29), to: isoDate(today) }
    case 'next_30':
      return { from: isoDate(today), to: addDays(isoDate(today), 29) }
    case 'this_year':
      return { from: isoDate(new Date(y, 0, 1)), to: isoDate(new Date(y, 11, 31)) }
    default:
      return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) }
  }
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function csvCell(v: string | number): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers, ...rows].map(r => r.map(csvCell).join(','))
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
