import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePortal } from '@/context/PortalContext'
import { Card } from '@/components/ui'
import { fmtDate } from './shared'

const TYPE_LABEL: Record<string, string> = {
  photo: 'Photo', note: 'Note', meal: 'Meal', medication: 'Medication', walk: 'Walk / play', wellbeing: 'Wellbeing',
}
const TYPE_COLOUR: Record<string, string> = {
  photo: '#6366f1', note: '#64748b', meal: '#10b981', medication: '#f43f5e', walk: '#0ea5e9', wellbeing: '#f59e0b',
}

type PUEntry = {
  id: string
  entry_type: string
  body: string | null
  photo_url: string | null
  created_at: string
  author_label: string | null
  booking: {
    start_date: string
    booking_pets: { pet: { name: string } | null }[]
  } | null
}

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return fmtDate(iso.slice(0, 10))
}

export default function PortalUpdatesPage() {
  const { owner, settings } = usePortal()
  const [entries, setEntries] = useState<PUEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!owner) return
    supabase
      .from('stay_journal_entries')
      .select('id, entry_type, body, photo_url, created_at, author_label, booking:booking_id ( start_date, booking_pets ( pet:pet_id ( name ) ) )')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEntries((data ?? []) as unknown as PUEntry[])
        setLoading(false)
      })
  }, [owner])

  if (settings && !settings.stay_journal_owner_visible) {
    return <Navigate to="/portal" replace />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Updates</h1>
        <p className="text-sm text-slate-500 mt-0.5">Photos and notes from your pets' stays.</p>
      </div>

      {loading ? (
        <Card><p className="text-sm text-slate-400 py-4 text-center">Loading…</p></Card>
      ) : entries.length === 0 ? (
        <Card><p className="text-sm text-slate-400 py-6 text-center italic">No updates yet. The kennels will post photos and notes here during your pets' stay.</p></Card>
      ) : (
        <div className="space-y-3">
          {entries.map(e => {
            const pets = e.booking?.booking_pets.map(bp => bp.pet?.name).filter(Boolean).join(', ')
            return (
              <Card key={e.id} padding="sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLOUR[e.entry_type] ?? '#94a3b8' }} />
                  <span className="text-sm font-semibold text-slate-900">{TYPE_LABEL[e.entry_type] ?? 'Update'}</span>
                  {pets && <span className="text-xs text-slate-400">· {pets}</span>}
                  <span className="text-xs text-slate-400 ml-auto">{relTime(e.created_at)}</span>
                </div>
                {e.body && <p className="text-sm text-slate-700 whitespace-pre-wrap">{e.body}</p>}
                {e.photo_url && (
                  <a href={e.photo_url} target="_blank" rel="noreferrer">
                    <img src={e.photo_url} alt="" loading="lazy" className="mt-2 rounded-lg max-h-72 w-auto" />
                  </a>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
