import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  ReportFrame, ExportButton, Metric, MetricRow,
  Table, Th, Td, ReportLoading, ReportEmpty, type ReportProps,
} from './parts'
import { todayIso, addDays } from '@/lib/reports'

type PetRow = {
  id: string
  name: string
  owner: { first_name: string; last_name: string } | null
  species: { name: string | null; icon: string | null } | null
  vaccinations: { is_verified: boolean; is_rejected: boolean; expiry_date: string | null }[]
}

type Issue = 'missing' | 'rejected' | 'expired' | 'expiring'
const ISSUE_LABEL: Record<Issue, string> = {
  missing:  'No verified vaccination',
  rejected: 'Document rejected',
  expired:  'Vaccination expired',
  expiring: 'Expiring soon',
}
const ISSUE_TONE: Record<Issue, string> = {
  missing:  'bg-rose-50 text-rose-700 border-rose-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  expired:  'bg-amber-50 text-amber-700 border-amber-200',
  expiring: 'bg-amber-50 text-amber-700 border-amber-200',
}

function issueFor(p: PetRow): Issue | null {
  const today = todayIso()
  const soon = addDays(today, 30)
  const verified = p.vaccinations.filter(v => v.is_verified)
  const hasRejected = p.vaccinations.some(v => v.is_rejected)
  if (verified.length === 0) return hasRejected ? 'rejected' : 'missing'
  if (verified.some(v => v.expiry_date && v.expiry_date < today)) return 'expired'
  if (verified.some(v => v.expiry_date && v.expiry_date >= today && v.expiry_date <= soon)) return 'expiring'
  return null
}

const ownerName = (p: PetRow) => p.owner ? `${p.owner.first_name} ${p.owner.last_name}` : '—'

export function VaccinationIssues({ canExport }: ReportProps) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<{ pet: PetRow; issue: Issue }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pets')
      .select('id, name, owner:owner_id ( first_name, last_name ), species:species_id ( name, icon ), vaccinations ( is_verified, is_rejected, expiry_date )')
      .eq('is_active', true)
      .order('name')
    const pets = (data ?? []) as unknown as PetRow[]
    const out: { pet: PetRow; issue: Issue }[] = []
    for (const p of pets) {
      const issue = issueFor(p)
      if (issue) out.push({ pet: p, issue })
    }
    // worst first
    const order: Issue[] = ['missing', 'rejected', 'expired', 'expiring']
    out.sort((a, b) => order.indexOf(a.issue) - order.indexOf(b.issue) || a.pet.name.localeCompare(b.pet.name))
    setRows(out)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <ReportLoading />

  const count = (i: Issue) => rows.filter(r => r.issue === i).length

  return (
    <ReportFrame
      title="Vaccination issues"
      description="Active pets that need attention before boarding"
      note="Reflects all active pets right now — not limited by the date range above."
      actions={<ExportButton enabled={canExport} filename="vaccination-issues"
        headers={['Pet', 'Owner', 'Species', 'Issue']}
        rows={rows.map(r => [r.pet.name, ownerName(r.pet), r.pet.species?.name ?? '', ISSUE_LABEL[r.issue]])} />}
    >
      <MetricRow>
        <Metric label="Pets with issues" value={rows.length} tone={rows.length > 0 ? 'negative' : 'positive'} />
        <Metric label="No verified" value={count('missing') + count('rejected')} />
        <Metric label="Expired" value={count('expired')} />
        <Metric label="Expiring soon" value={count('expiring')} tone="warning" />
      </MetricRow>

      {rows.length === 0 ? (
        <ReportEmpty message="Every active pet has an in-date, verified vaccination. 🎉" />
      ) : (
        <Table>
          <thead><tr><Th>Pet</Th><Th>Owner</Th><Th>Issue</Th><Th /></tr></thead>
          <tbody>
            {rows.map(({ pet, issue }) => (
              <tr key={pet.id}>
                <Td strong>
                  <span className="inline-flex items-center gap-1.5">
                    <span>{pet.species?.icon ?? '🐾'}</span>{pet.name}
                  </span>
                </Td>
                <Td>{ownerName(pet)}</Td>
                <Td>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ISSUE_TONE[issue]}`}>
                    {ISSUE_LABEL[issue]}
                  </span>
                </Td>
                <Td align="right">
                  <Link to={`/pets/${pet.id}`} className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline">
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ReportFrame>
  )
}
