import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  ReportFrame, ExportButton, Metric, MetricRow,
  Table, Th, Td, ReportLoading, ReportEmpty, type ReportProps,
} from './parts'
import { fmtMoney, fmtDate } from '@/lib/reports'

type B = {
  owner_id: string
  status: string
  total_amount: number | null
  start_date: string
  owner: { first_name: string; last_name: string } | null
}

type Row = {
  ownerId: string
  name: string
  bookings: number
  spent: number
  lastStay: string
}

export function RepeatCustomers({ currency, canExport }: ReportProps) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('owner_id, status, total_amount, start_date, owner:owner_id ( first_name, last_name )')
      .neq('status', 'cancelled')
    const bookings = (data ?? []) as unknown as B[]

    const map = new Map<string, Row>()
    for (const b of bookings) {
      let r = map.get(b.owner_id)
      if (!r) {
        r = {
          ownerId: b.owner_id,
          name: b.owner ? `${b.owner.first_name} ${b.owner.last_name}` : 'Unknown owner',
          bookings: 0, spent: 0, lastStay: b.start_date,
        }
        map.set(b.owner_id, r)
      }
      r.bookings += 1
      r.spent += b.total_amount ?? 0
      if (b.start_date > r.lastStay) r.lastStay = b.start_date
    }
    const out = [...map.values()].filter(r => r.bookings > 1)
    out.sort((a, b) => b.bookings - a.bookings || b.spent - a.spent)
    setRows(out)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportLoading />
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const topName = rows[0]?.name ?? '—'

  return (
    <ReportFrame
      title="Repeat customers"
      description="Owners who've booked more than once"
      note="All time — not limited by the date range above."
      actions={<ExportButton enabled={canExport} filename="repeat-customers"
        headers={['Owner', 'Bookings', 'Total spent', 'Last stay']}
        rows={rows.map(r => [r.name, r.bookings, r.spent, r.lastStay])} />}
    >
      <MetricRow>
        <Metric label="Repeat customers" value={rows.length} tone="positive" />
        <Metric label="Their total spend" value={fmtMoney(totalSpent, currency)} />
        <Metric label="Most loyal" value={topName} sub={rows[0] ? `${rows[0].bookings} bookings` : ''} />
      </MetricRow>

      {rows.length === 0 ? (
        <ReportEmpty message="No repeat customers yet — every booking so far is from a first-timer." />
      ) : (
        <Table>
          <thead><tr>
            <Th>Owner</Th><Th align="right">Bookings</Th><Th align="right">Total spent</Th><Th>Last stay</Th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.ownerId}>
                <Td strong>
                  <Link to={`/owners/${r.ownerId}`} className="hover:underline">{r.name}</Link>
                </Td>
                <Td align="right" strong>{r.bookings}</Td>
                <Td align="right">{fmtMoney(r.spent, currency)}</Td>
                <Td>{fmtDate(r.lastStay)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ReportFrame>
  )
}
