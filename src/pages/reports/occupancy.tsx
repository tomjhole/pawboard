import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ReportFrame, ExportButton, Metric, MetricRow, Bar, MiniBarChart,
  Table, Th, Td, ReportLoading, ReportEmpty, type ReportProps,
} from './parts'
import {
  eachDay, addDays, fmtDate, fmtDateShort, pct, type DateRange,
} from '@/lib/reports'

type AssignRow = {
  space_id: string
  start_date: string
  end_date: string
  booking_pet: {
    booking: { status: string } | null
    pet: { species: { id: string; name: string; colour: string | null } | null } | null
  } | null
}

async function loadAssignments(range: DateRange): Promise<AssignRow[]> {
  const { data } = await supabase
    .from('booking_space_assignments')
    .select('space_id, start_date, end_date, booking_pet:booking_pet_id ( booking:booking_id ( status ), pet:pet_id ( species:species_id ( id, name, colour ) ) )')
    .lte('start_date', range.to)
    .gte('end_date', range.from)
  return (data ?? []) as unknown as AssignRow[]
}

async function loadSpaceCount(): Promise<number> {
  const { count } = await supabase
    .from('accommodation_spaces')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
  return count ?? 0
}

// Occupied *nights* per day (a stay start..end occupies nights start..end-1)
function dailyOccupied(assigns: AssignRow[], range: DateRange): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>()
  for (const a of assigns) {
    if (a.booking_pet?.booking?.status === 'cancelled') continue
    const s = a.start_date < range.from ? range.from : a.start_date
    const lastNight = addDays(a.end_date, -1)
    const e = lastNight > range.to ? range.to : lastNight
    if (s > e) continue
    for (const day of eachDay(s, e)) {
      let set = m.get(day)
      if (!set) { set = new Set(); m.set(day, set) }
      set.add(a.space_id)
    }
  }
  return m
}

// ─── Occupancy by date ───────────────────────────────────────────────────────

export function OccupancyByDate({ range, canExport }: ReportProps) {
  const [loading, setLoading] = useState(true)
  const [total,   setTotal]   = useState(0)
  const [days,    setDays]    = useState<{ date: string; occupied: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [assigns, count] = await Promise.all([loadAssignments(range), loadSpaceCount()])
    const occ = dailyOccupied(assigns, range)
    setTotal(count)
    setDays(eachDay(range.from, range.to).map(date => ({ date, occupied: occ.get(date)?.size ?? 0 })))
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportLoading />

  const avg  = days.length ? Math.round(days.reduce((s, d) => s + pct(d.occupied, total), 0) / days.length) : 0
  const peak = days.reduce((mx, d) => d.occupied > mx.occupied ? d : mx, { date: '', occupied: 0 })

  return (
    <ReportFrame
      title="Occupancy by date"
      description={`Spaces occupied each night · ${fmtDate(range.from)} – ${fmtDate(range.to)}`}
      actions={<ExportButton enabled={canExport} filename="occupancy-by-date"
        headers={['Date', 'Occupied', 'Total spaces', 'Occupancy %']}
        rows={days.map(d => [d.date, d.occupied, total, pct(d.occupied, total)])} />}
    >
      <MetricRow>
        <Metric label="Total spaces" value={total} />
        <Metric label="Average occupancy" value={`${avg}%`} tone={avg >= 75 ? 'negative' : avg >= 50 ? 'warning' : 'positive'} />
        <Metric label="Peak night" value={peak.occupied} sub={peak.date ? fmtDateShort(peak.date) : '—'} />
        <Metric label="Nights shown" value={days.length} />
      </MetricRow>

      {total === 0 ? (
        <ReportEmpty message="No active spaces configured yet." />
      ) : (
        <Table>
          <thead><tr>
            <Th>Date</Th><Th align="right">Occupied</Th><Th align="right">Free</Th><Th>Occupancy</Th>
          </tr></thead>
          <tbody>
            {days.map(d => {
              const p = pct(d.occupied, total)
              return (
                <tr key={d.date}>
                  <Td>{fmtDate(d.date)}</Td>
                  <Td align="right" strong>{d.occupied}</Td>
                  <Td align="right">{Math.max(0, total - d.occupied)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Bar value={d.occupied} max={total}
                        colour={p >= 75 ? '#ef4444' : p >= 50 ? '#f59e0b' : '#10b981'} />
                      <span className="text-xs tabular-nums text-slate-500 w-9 text-right">{p}%</span>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </ReportFrame>
  )
}

// ─── Occupancy by species ────────────────────────────────────────────────────

export function OccupancyBySpecies({ range, canExport }: ReportProps) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<{ name: string; colour: string | null; pets: number; nights: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const assigns = await loadAssignments(range)
    const map = new Map<string, { name: string; colour: string | null; pets: Set<string>; nights: number }>()
    for (const a of assigns) {
      if (a.booking_pet?.booking?.status === 'cancelled') continue
      const sp = a.booking_pet?.pet?.species
      const key = sp?.id ?? 'unknown'
      const name = sp?.name ?? 'Unknown'
      const s = a.start_date < range.from ? range.from : a.start_date
      const lastNight = addDays(a.end_date, -1)
      const e = lastNight > range.to ? range.to : lastNight
      const nights = s > e ? 0 : eachDay(s, e).length
      let g = map.get(key)
      if (!g) { g = { name, colour: sp?.colour ?? null, pets: new Set(), nights: 0 }; map.set(key, g) }
      g.nights += nights
      // distinct pet per species — approximate via space+species not available; count assignments' pets
      g.pets.add(`${key}:${a.space_id}:${a.start_date}`)
    }
    const out = [...map.values()].map(g => ({ name: g.name, colour: g.colour, pets: g.pets.size, nights: g.nights }))
    out.sort((x, y) => y.nights - x.nights)
    setRows(out)
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportLoading />
  const totalNights = rows.reduce((s, r) => s + r.nights, 0)
  const maxNights = Math.max(1, ...rows.map(r => r.nights))

  return (
    <ReportFrame
      title="Occupancy by species"
      description={`Pet-nights boarded per species · ${fmtDate(range.from)} – ${fmtDate(range.to)}`}
      actions={<ExportButton enabled={canExport} filename="occupancy-by-species"
        headers={['Species', 'Stays', 'Nights', 'Share %']}
        rows={rows.map(r => [r.name, r.pets, r.nights, pct(r.nights, totalNights)])} />}
    >
      {rows.length === 0 ? (
        <ReportEmpty message="No stays in this date range." />
      ) : (
        <Table>
          <thead><tr>
            <Th>Species</Th><Th align="right">Stays</Th><Th align="right">Nights</Th><Th>Share of nights</Th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name}>
                <Td strong>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.colour ?? '#94a3b8' }} />
                    {r.name}
                  </span>
                </Td>
                <Td align="right">{r.pets}</Td>
                <Td align="right" strong>{r.nights}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Bar value={r.nights} max={maxNights} colour={r.colour ?? undefined} />
                    <span className="text-xs tabular-nums text-slate-500 w-9 text-right">{pct(r.nights, totalNights)}%</span>
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

// ─── Occupancy trends (premium) ──────────────────────────────────────────────

export function OccupancyTrends({ range, canExport }: ReportProps) {
  const [loading, setLoading] = useState(true)
  const [total,   setTotal]   = useState(0)
  const [buckets, setBuckets] = useState<{ label: string; from: string; to: string; avg: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [assigns, count] = await Promise.all([loadAssignments(range), loadSpaceCount()])
    const occ = dailyOccupied(assigns, range)
    const allDays = eachDay(range.from, range.to)
    const monthly = allDays.length > 84

    // Build buckets
    const groups = new Map<string, { label: string; from: string; to: string; days: string[] }>()
    for (const day of allDays) {
      let key: string, label: string
      if (monthly) {
        key = day.slice(0, 7)
        label = new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
      } else {
        // 7-day chunks from range start
        const idx = Math.floor(eachDay(range.from, day).length - 1) // days since start (0-based)
        const chunk = Math.floor(idx / 7)
        key = `w${chunk}`
        label = fmtDateShort(addDays(range.from, chunk * 7))
      }
      let g = groups.get(key)
      if (!g) { g = { label, from: day, to: day, days: [] }; groups.set(key, g) }
      g.days.push(day); g.to = day
    }

    const out = [...groups.values()].map(g => {
      const avg = g.days.length
        ? Math.round(g.days.reduce((s, d) => s + pct(occ.get(d)?.size ?? 0, count), 0) / g.days.length)
        : 0
      return { label: g.label, from: g.from, to: g.to, avg }
    })
    setTotal(count)
    setBuckets(out)
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportLoading />

  return (
    <ReportFrame
      title="Occupancy trends"
      description={`Average occupancy over time · ${fmtDate(range.from)} – ${fmtDate(range.to)}`}
      actions={<ExportButton enabled={canExport} filename="occupancy-trends"
        headers={['Period start', 'Period end', 'Avg occupancy %']}
        rows={buckets.map(b => [b.from, b.to, b.avg])} />}
    >
      {total === 0 || buckets.length === 0 ? (
        <ReportEmpty message="No occupancy data for this date range." />
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
            <MiniBarChart data={buckets.map(b => ({ label: b.label, value: b.avg }))} valueFmt={v => `${v}%`} />
          </div>
          <Table>
            <thead><tr><Th>Period</Th><Th align="right">Avg occupancy</Th></tr></thead>
            <tbody>
              {buckets.map((b, i) => (
                <tr key={i}>
                  <Td>{fmtDate(b.from)} – {fmtDate(b.to)}</Td>
                  <Td align="right" strong>{b.avg}%</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </ReportFrame>
  )
}
