import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock } from 'lucide-react'

type AuditEntry = {
  id:          string
  actor_label: string | null
  action:      string
  before:      Record<string, unknown> | null
  after:       Record<string, unknown> | null
  meta:        Record<string, unknown> | null
  created_at:  string
}

const ACTION_LABELS: Record<string, string> = {
  'booking.created':          'Booking created',
  'booking.updated':          'Booking updated',
  'booking.status_changed':   'Status changed',
  'booking.checked_in':       'Checked in',
  'booking.checked_out':      'Checked out',
  'space_assignment.changed': 'Space reassigned',
  'pet.created':              'Pet record created',
  'pet.updated':              'Pet record updated',
  'owner.updated':            'Owner details updated',
  'vaccination.added':        'Vaccination added',
  'vaccination.updated':      'Vaccination updated',
  'vaccination.verified':     'Vaccination verified',
  'space.created':            'Space created',
  'space.updated':            'Space updated',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtStatus(s: unknown): string {
  if (typeof s !== 'string') return String(s ?? '')
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function EntryDetail({ entry }: { entry: AuditEntry }) {
  const { action, before, after, meta } = entry

  if (action === 'booking.status_changed' || action === 'booking.checked_in' || action === 'booking.checked_out') {
    const prev = before?.status as string | undefined
    const next = after?.status  as string | undefined
    if (prev && next) {
      return <span className="text-slate-500">{fmtStatus(prev)} → {fmtStatus(next)}</span>
    }
  }

  if (action === 'space_assignment.changed') {
    const prev    = before?.space    as string | undefined
    const next    = after?.space     as string | undefined
    const petName = meta?.pet_name   as string | undefined
    return (
      <span className="text-slate-500">
        {petName ? `${petName}: ` : ''}{prev ?? 'unassigned'} → {next ?? 'unassigned'}
      </span>
    )
  }

  if (action === 'booking.updated') {
    const parts: string[] = []
    if (before?.start_date !== after?.start_date) parts.push('arrival')
    if (before?.end_date   !== after?.end_date)   parts.push('departure')
    if (before?.notes      !== after?.notes)       parts.push('notes')
    if (parts.length > 0) return <span className="text-slate-500">{parts.join(', ')} changed</span>
  }

  if (action === 'vaccination.verified' || action === 'vaccination.added' || action === 'vaccination.updated') {
    const type = (after?.vaccination_type ?? meta?.vaccination_type) as string | undefined
    if (type) return <span className="text-slate-500">{type}</span>
  }

  if (action === 'space.created' || action === 'space.updated') {
    const name = after?.name as string | undefined
    if (name) return <span className="text-slate-500">{name}</span>
  }

  return null
}

export function AuditLog({ entityId }: { entityId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id, actor_label, action, before, after, meta, created_at')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEntries((data ?? []) as AuditEntry[])
        setLoading(false)
      })
  }, [entityId])

  if (loading || entries.length === 0) return null

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <Clock className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {entries.map(entry => (
          <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0 mt-[9px]" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-800">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <EntryDetail entry={entry} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400">{entry.actor_label ?? 'Unknown user'}</span>
                <span className="text-xs text-slate-300">·</span>
                <span
                  className="text-xs text-slate-400"
                  title={new Date(entry.created_at).toLocaleString('en-GB')}
                >
                  {relativeTime(entry.created_at)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
