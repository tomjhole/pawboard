import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ReportFrame, ExportButton, Metric, MetricRow,
  Table, Th, Td, ReportLoading, ReportEmpty, type ReportProps,
} from './parts'
import { fmtDate, pct } from '@/lib/reports'

type BookingRow = {
  id: string
  start_date: string
  end_date: string
  status: string
  notes: string | null
  owner: { first_name: string; last_name: string } | null
  booking_pets: { pet: { name: string } | null }[]
}

function ownerName(b: BookingRow) {
  return b.owner ? `${b.owner.first_name} ${b.owner.last_name}` : '—'
}
function petNames(b: BookingRow) {
  return b.booking_pets.map(bp => bp.pet?.name).filter(Boolean).join(', ') || '—'
}

const SELECT = 'id, start_date, end_date, status, notes, owner:owner_id ( first_name, last_name ), booking_pets ( pet:pet_id ( name ) )'

// ─── Arrivals / departures ───────────────────────────────────────────────────

export function ArrivalsDepartures({ range, canExport }: ReportProps) {
  const [loading,    setLoading]    = useState(true)
  const [arrivals,   setArrivals]   = useState<BookingRow[]>([])
  const [departures, setDepartures] = useState<BookingRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [aRes, dRes] = await Promise.all([
      supabase.from('bookings').select(SELECT)
        .gte('start_date', range.from).lte('start_date', range.to)
        .neq('status', 'cancelled').order('start_date'),
      supabase.from('bookings').select(SELECT)
        .gte('end_date', range.from).lte('end_date', range.to)
        .neq('status', 'cancelled').order('end_date'),
    ])
    setArrivals((aRes.data ?? []) as unknown as BookingRow[])
    setDepartures((dRes.data ?? []) as unknown as BookingRow[])
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportLoading />

  const exportRows: (string | number)[][] = [
    ...arrivals.map(b => ['Arrival', b.start_date, ownerName(b), petNames(b)]),
    ...departures.map(b => ['Departure', b.end_date, ownerName(b), petNames(b)]),
  ]

  return (
    <ReportFrame
      title="Arrivals & departures"
      description={`Check-ins and check-outs · ${fmtDate(range.from)} – ${fmtDate(range.to)}`}
      actions={<ExportButton enabled={canExport} filename="arrivals-departures"
        headers={['Type', 'Date', 'Owner', 'Pets']} rows={exportRows} />}
    >
      <MetricRow>
        <Metric label="Arrivals" value={arrivals.length} tone="positive" />
        <Metric label="Departures" value={departures.length} tone="warning" />
        <Metric label="Net change" value={arrivals.length - departures.length} />
        <Metric label="Movements" value={arrivals.length + departures.length} />
      </MetricRow>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MovementList title="Arrivals" rows={arrivals} dateKey="start_date" empty="No arrivals in this range." />
        <MovementList title="Departures" rows={departures} dateKey="end_date" empty="No departures in this range." />
      </div>
    </ReportFrame>
  )
}

function MovementList({ title, rows, dateKey, empty }: {
  title: string; rows: BookingRow[]; dateKey: 'start_date' | 'end_date'; empty: string
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-2">{title} <span className="text-slate-400 font-normal">({rows.length})</span></h3>
      {rows.length === 0 ? (
        <ReportEmpty message={empty} />
      ) : (
        <Table>
          <thead><tr><Th>Date</Th><Th>Owner</Th><Th>Pets</Th></tr></thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id}>
                <Td>{fmtDate(b[dateKey])}</Td>
                <Td strong>{ownerName(b)}</Td>
                <Td>{petNames(b)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}

// ─── Cancellations (premium) ─────────────────────────────────────────────────

export function Cancellations({ range, canExport }: ReportProps) {
  const [loading, setLoading]   = useState(true)
  const [cancelled, setCancelled] = useState<BookingRow[]>([])
  const [totalInRange, setTotal]  = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const [cRes, allRes] = await Promise.all([
      supabase.from('bookings').select(SELECT)
        .gte('start_date', range.from).lte('start_date', range.to)
        .eq('status', 'cancelled').order('start_date'),
      supabase.from('bookings').select('id', { count: 'exact', head: true })
        .gte('start_date', range.from).lte('start_date', range.to),
    ])
    setCancelled((cRes.data ?? []) as unknown as BookingRow[])
    setTotal((allRes.count ?? 0))
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportLoading />
  const rate = pct(cancelled.length, totalInRange)

  return (
    <ReportFrame
      title="Cancellations"
      description={`Cancelled bookings due to start in this period · ${fmtDate(range.from)} – ${fmtDate(range.to)}`}
      actions={<ExportButton enabled={canExport} filename="cancellations"
        headers={['Start date', 'End date', 'Owner', 'Pets', 'Reason / notes']}
        rows={cancelled.map(b => [b.start_date, b.end_date, ownerName(b), petNames(b), b.notes ?? ''])} />}
    >
      <MetricRow>
        <Metric label="Cancellations" value={cancelled.length} tone="negative" />
        <Metric label="Bookings in period" value={totalInRange} />
        <Metric label="Cancellation rate" value={`${rate}%`} tone={rate >= 20 ? 'negative' : rate >= 10 ? 'warning' : 'positive'} />
      </MetricRow>

      {cancelled.length === 0 ? (
        <ReportEmpty message="No cancellations in this range — nice." />
      ) : (
        <Table>
          <thead><tr><Th>Dates</Th><Th>Owner</Th><Th>Pets</Th><Th>Reason / notes</Th></tr></thead>
          <tbody>
            {cancelled.map(b => (
              <tr key={b.id}>
                <Td>{fmtDate(b.start_date)} – {fmtDate(b.end_date)}</Td>
                <Td strong>{ownerName(b)}</Td>
                <Td>{petNames(b)}</Td>
                <Td>{b.notes ?? <span className="text-slate-300">—</span>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ReportFrame>
  )
}
