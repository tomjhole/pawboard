import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ReportFrame, ExportButton, Metric, MetricRow, Bar,
  Table, Th, Td, ReportLoading, ReportEmpty, type ReportProps,
} from './parts'
import { fmtMoney, fmtDate, pct } from '@/lib/reports'

const COMMITTED = ['confirmed', 'details_outstanding', 'ready', 'checked_in', 'due_out', 'checked_out']

type RevBooking = {
  id: string
  start_date: string
  end_date: string
  status: string
  total_amount: number | null
  deposit_amount: number | null
  deposit_paid: boolean
  balance_paid: boolean
  owner: { first_name: string; last_name: string } | null
}

const ownerName = (b: RevBooking) => b.owner ? `${b.owner.first_name} ${b.owner.last_name}` : '—'
const outstandingOf = (b: RevBooking) =>
  Math.max(0, (b.total_amount ?? 0) - (b.deposit_paid ? (b.deposit_amount ?? 0) : 0))

// ─── Revenue summary ─────────────────────────────────────────────────────────

export function RevenueSummary({ range, currency, canExport }: ReportProps) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<RevBooking[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('id, start_date, end_date, status, total_amount, deposit_amount, deposit_paid, balance_paid, owner:owner_id ( first_name, last_name )')
      .gte('start_date', range.from).lte('start_date', range.to)
      .neq('status', 'cancelled')
      .order('start_date')
    setRows((data ?? []) as unknown as RevBooking[])
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportLoading />

  const priced     = rows.filter(b => b.total_amount != null)
  const total      = priced.reduce((s, b) => s + (b.total_amount ?? 0), 0)
  const deposits   = rows.reduce((s, b) => s + (b.deposit_paid ? (b.deposit_amount ?? 0) : 0), 0)
  const outstanding = rows.filter(b => !b.balance_paid).reduce((s, b) => s + outstandingOf(b), 0)
  const avg        = priced.length ? total / priced.length : 0

  return (
    <ReportFrame
      title="Revenue summary"
      description={`Bookings starting ${fmtDate(range.from)} – ${fmtDate(range.to)}`}
      note="Based on the total saved on each booking. Bookings with no total set are excluded from revenue."
      actions={<ExportButton enabled={canExport} filename="revenue-summary"
        headers={['Start', 'Owner', 'Status', 'Total', 'Deposit paid', 'Balance paid', 'Outstanding']}
        rows={rows.map(b => [b.start_date, ownerName(b), b.status, b.total_amount ?? 0,
          b.deposit_paid ? 'yes' : 'no', b.balance_paid ? 'yes' : 'no', outstandingOf(b)])} />}
    >
      <MetricRow>
        <Metric label="Total revenue" value={fmtMoney(total, currency)} tone="positive" />
        <Metric label="Deposits collected" value={fmtMoney(deposits, currency)} />
        <Metric label="Outstanding" value={fmtMoney(outstanding, currency)} tone={outstanding > 0 ? 'warning' : 'default'} />
        <Metric label="Avg booking" value={fmtMoney(avg, currency)} sub={`${priced.length} priced`} />
      </MetricRow>

      {rows.length === 0 ? (
        <ReportEmpty message="No bookings starting in this range." />
      ) : (
        <Table>
          <thead><tr>
            <Th>Start</Th><Th>Owner</Th><Th>Status</Th><Th align="right">Total</Th><Th align="right">Outstanding</Th>
          </tr></thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id}>
                <Td>{fmtDate(b.start_date)}</Td>
                <Td strong>{ownerName(b)}</Td>
                <Td><span className="text-xs text-slate-500 capitalize">{b.status.replace(/_/g, ' ')}</span></Td>
                <Td align="right">{b.total_amount != null ? fmtMoney(b.total_amount, currency) : '—'}</Td>
                <Td align="right">{!b.balance_paid && outstandingOf(b) > 0
                  ? <span className="text-amber-700">{fmtMoney(outstandingOf(b), currency)}</span>
                  : <span className="text-emerald-600">Paid</span>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ReportFrame>
  )
}

// ─── Outstanding balances (all-time) ─────────────────────────────────────────

export function OutstandingBalances({ currency, canExport }: ReportProps) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<RevBooking[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('id, start_date, end_date, status, total_amount, deposit_amount, deposit_paid, balance_paid, owner:owner_id ( first_name, last_name )')
      .eq('balance_paid', false)
      .not('total_amount', 'is', null)
      .in('status', COMMITTED)
      .order('start_date')
    const list = ((data ?? []) as unknown as RevBooking[]).filter(b => outstandingOf(b) > 0)
    list.sort((a, b) => outstandingOf(b) - outstandingOf(a))
    setRows(list)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportLoading />
  const total = rows.reduce((s, b) => s + outstandingOf(b), 0)
  const maxOut = Math.max(1, ...rows.map(outstandingOf))

  return (
    <ReportFrame
      title="Outstanding balances"
      description="Confirmed bookings with money still owed"
      note="All time — not limited by the date range above."
      actions={<ExportButton enabled={canExport} filename="outstanding-balances"
        headers={['Start', 'End', 'Owner', 'Status', 'Total', 'Deposit paid', 'Outstanding']}
        rows={rows.map(b => [b.start_date, b.end_date, ownerName(b), b.status, b.total_amount ?? 0,
          b.deposit_paid ? (b.deposit_amount ?? 0) : 0, outstandingOf(b)])} />}
    >
      <MetricRow>
        <Metric label="Total outstanding" value={fmtMoney(total, currency)} tone={total > 0 ? 'warning' : 'positive'} />
        <Metric label="Bookings owing" value={rows.length} />
        <Metric label="Largest balance" value={rows.length ? fmtMoney(outstandingOf(rows[0]), currency) : fmtMoney(0, currency)} />
      </MetricRow>

      {rows.length === 0 ? (
        <ReportEmpty message="Nothing outstanding — all balances are settled." />
      ) : (
        <Table>
          <thead><tr>
            <Th>Dates</Th><Th>Owner</Th><Th align="right">Total</Th><Th align="right">Outstanding</Th><Th>Share</Th>
          </tr></thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id}>
                <Td>{fmtDate(b.start_date)} – {fmtDate(b.end_date)}</Td>
                <Td strong>{ownerName(b)}</Td>
                <Td align="right">{fmtMoney(b.total_amount ?? 0, currency)}</Td>
                <Td align="right" strong><span className="text-amber-700">{fmtMoney(outstandingOf(b), currency)}</span></Td>
                <Td><Bar value={outstandingOf(b)} max={maxOut} colour="#f59e0b" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ReportFrame>
  )
}

// ─── Revenue by space type (premium) ─────────────────────────────────────────

type RBSBooking = {
  total_amount: number | null
  status: string
  booking_pets: {
    booking_space_assignments: {
      space: { type: { name: string } | null } | null
    }[]
  }[]
}

export function RevenueBySpaceType({ range, currency, canExport }: ReportProps) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<{ name: string; revenue: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('total_amount, status, booking_pets ( booking_space_assignments ( space:space_id ( type:space_type_id ( name ) ) ) )')
      .gte('start_date', range.from).lte('start_date', range.to)
      .neq('status', 'cancelled')
      .not('total_amount', 'is', null)
    const bookings = (data ?? []) as unknown as RBSBooking[]

    const buckets = new Map<string, number>()
    for (const b of bookings) {
      const assigns = b.booking_pets.flatMap(bp => bp.booking_space_assignments)
      const total = b.total_amount ?? 0
      if (assigns.length === 0) {
        buckets.set('Unassigned', (buckets.get('Unassigned') ?? 0) + total)
        continue
      }
      const share = total / assigns.length
      for (const a of assigns) {
        const name = a.space?.type?.name ?? 'Unspecified'
        buckets.set(name, (buckets.get(name) ?? 0) + share)
      }
    }
    const out = [...buckets.entries()].map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }))
    out.sort((a, b) => b.revenue - a.revenue)
    setRows(out)
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportLoading />
  const total = rows.reduce((s, r) => s + r.revenue, 0)
  const max = Math.max(1, ...rows.map(r => r.revenue))

  return (
    <ReportFrame
      title="Revenue by space type"
      description={`Where revenue comes from · ${fmtDate(range.from)} – ${fmtDate(range.to)}`}
      note="Each booking's total is split evenly across its assigned spaces, then grouped by space type (an approximation)."
      actions={<ExportButton enabled={canExport} filename="revenue-by-space-type"
        headers={['Space type', 'Revenue', 'Share %']}
        rows={rows.map(r => [r.name, r.revenue, pct(r.revenue, total)])} />}
    >
      <MetricRow>
        <Metric label="Total revenue" value={fmtMoney(total, currency)} tone="positive" />
        <Metric label="Space types" value={rows.length} />
        <Metric label="Top earner" value={rows[0]?.name ?? '—'} sub={rows[0] ? fmtMoney(rows[0].revenue, currency) : ''} />
      </MetricRow>

      {rows.length === 0 ? (
        <ReportEmpty message="No priced bookings in this range." />
      ) : (
        <Table>
          <thead><tr><Th>Space type</Th><Th align="right">Revenue</Th><Th>Share</Th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name}>
                <Td strong>{r.name}</Td>
                <Td align="right" strong>{fmtMoney(r.revenue, currency)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Bar value={r.revenue} max={max} />
                    <span className="text-xs tabular-nums text-slate-500 w-9 text-right">{pct(r.revenue, total)}%</span>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ReportFrame>
  )
}
