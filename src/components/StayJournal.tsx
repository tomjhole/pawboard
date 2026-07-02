import { useState, useEffect, useCallback } from 'react'
import {
  Camera, StickyNote, UtensilsCrossed, Pill, Footprints, Heart,
  Plus, WifiOff, UploadCloud, Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { usePlan } from '@/lib/plans'
import { canEdit as canEditRole } from '@/lib/roles'
import { Button, Textarea, Modal } from '@/components/ui'
import { listQueued, flushQueue, submitJournalEntry, type QueuedEntry } from '@/lib/journalQueue'
import type { Database } from '@/types/database'

type Entry = Database['public']['Tables']['stay_journal_entries']['Row']
export type EntryType = 'photo' | 'note' | 'meal' | 'medication' | 'walk' | 'wellbeing'

const TYPES: { id: EntryType; label: string; icon: LucideIcon; colour: string }[] = [
  { id: 'photo',      label: 'Photo',       icon: Camera,          colour: '#6366f1' },
  { id: 'note',       label: 'Note',        icon: StickyNote,      colour: '#64748b' },
  { id: 'meal',       label: 'Meal',        icon: UtensilsCrossed, colour: '#10b981' },
  { id: 'medication', label: 'Medication',  icon: Pill,            colour: '#f43f5e' },
  { id: 'walk',       label: 'Walk / play', icon: Footprints,      colour: '#0ea5e9' },
  { id: 'wellbeing',  label: 'Wellbeing',   icon: Heart,           colour: '#f59e0b' },
]
const typeMeta = (id: string) => TYPES.find(t => t.id === id) ?? TYPES[1]

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function QueuedPhoto({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  if (!url) return null
  return <img src={url} alt="" className="mt-2 rounded-lg max-h-56 w-auto opacity-70" />
}

function TypeIcon({ type }: { type: string }) {
  const m = typeMeta(type)
  const Icon = m.icon
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${m.colour}1a`, color: m.colour }}>
      <Icon className="w-4 h-4" />
    </div>
  )
}

export default function StayJournal({ bookingId }: { bookingId: string }) {
  const { settings, business, staffUser, isAdmin } = useBusinessContext()
  const { can } = usePlan()
  const canEdit = isAdmin || canEditRole(staffUser?.role ?? 'read_only')
  const authorLabel = staffUser ? `${staffUser.first_name} ${staffUser.last_name}`.trim() : 'Staff'

  const [entries, setEntries] = useState<Entry[]>([])
  const [queued,  setQueued]  = useState<QueuedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [online,  setOnline]  = useState(navigator.onLine)
  const [open,    setOpen]    = useState(false)

  const load = useCallback(async () => {
    const [eRes, q] = await Promise.all([
      supabase.from('stay_journal_entries').select('*').eq('booking_id', bookingId).order('created_at', { ascending: false }),
      listQueued(bookingId),
    ])
    setEntries((eRes.data ?? []) as Entry[])
    setQueued(q)
    setLoading(false)
  }, [bookingId])

  useEffect(() => {
    flushQueue().then(load)
    function goOnline()  { setOnline(true);  flushQueue().then(load) }
    function goOffline() { setOnline(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [load])

  if (!can('stayJournal')) return null   // Stay Journal is a Premium feature
  if (settings && settings.stay_journal_enabled === false) return null

  async function addEntry(type: EntryType, body: string, file: File | null) {
    if (!business) return
    await submitJournalEntry({ businessId: business.id, bookingId, authorLabel, entryType: type, body, file })
    await load()
  }

  return (
    <div className="mt-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 flex-1">Stay Journal</h3>
          {!online && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          )}
          {queued.length > 0 && (
            <button onClick={() => flushQueue().then(load)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700" title="Retry upload">
              <UploadCloud className="w-3.5 h-3.5" /> {queued.length} queued
            </button>
          )}
          {canEdit && (
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setOpen(true)}>Add update</Button>
          )}
        </div>

        {!online && (
          <div className="px-5 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">
            You're offline — updates are saved on this device and upload automatically when you're back online.
          </div>
        )}

        {loading ? (
          <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
        ) : entries.length === 0 && queued.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400 italic">No updates yet. Add a photo or note to keep the owner in the loop.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {/* Queued (pending upload) */}
            {queued.map(q => (
              <li key={q.id} className="flex gap-3 px-5 py-3 bg-slate-50/40">
                <TypeIcon type={q.entryType} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{typeMeta(q.entryType).label}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                      <Loader2 className="w-3 h-3 animate-spin" /> Waiting to upload
                    </span>
                  </div>
                  {q.body && <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{q.body}</p>}
                  {q.blob && <QueuedPhoto blob={q.blob} />}
                </div>
              </li>
            ))}
            {/* Saved entries */}
            {entries.map(e => (
              <li key={e.id} className="flex gap-3 px-5 py-3">
                <TypeIcon type={e.entry_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900">{typeMeta(e.entry_type).label}</span>
                    <span className="text-xs text-slate-400">
                      {e.author_label ? `${e.author_label} · ` : ''}{relativeTime(e.created_at)}
                    </span>
                  </div>
                  {e.body && <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{e.body}</p>}
                  {e.photo_url && (
                    <a href={e.photo_url} target="_blank" rel="noreferrer">
                      <img src={e.photo_url} alt="" loading="lazy" className="mt-2 rounded-lg max-h-56 w-auto hover:opacity-95 transition-opacity" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && <AddUpdateModal onClose={() => setOpen(false)} onAdd={async (t, b, f) => { await addEntry(t, b, f); setOpen(false) }} />}
    </div>
  )
}

// ─── Add update modal ────────────────────────────────────────────────────────

export function AddUpdateModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (type: EntryType, body: string, file: File | null) => Promise<void>
}) {
  const [type, setType]   = useState<EntryType>('note')
  const [body, setBody]   = useState('')
  const [file, setFile]   = useState<File | null>(null)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (type === 'photo' && !file) { setError('Choose a photo, or pick a different update type.'); return }
    if (type !== 'photo' && !body.trim() && !file) { setError('Add a note or a photo.'); return }
    setBusy(true); setError(null)
    try { await onAdd(type, body, file) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save'); setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} size="sm" title="Add stay update"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button form="add-update" type="submit" loading={busy}>Add update</Button>
      </>}
    >
      <form id="add-update" onSubmit={submit} className="space-y-3" noValidate>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div>
          <p className="text-sm font-medium text-slate-700 mb-1.5">Type</p>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(t => {
              const active = type === t.id
              const Icon = t.icon
              return (
                <button key={t.id} type="button" onClick={() => setType(t.id)}
                  className={['flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-xs font-medium transition-colors',
                    active ? 'border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300'].join(' ')}
                  style={active ? { backgroundColor: `${t.colour}1a`, color: t.colour, borderColor: t.colour } : {}}>
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <Textarea id="up-body" label={type === 'photo' ? 'Caption (optional)' : 'Update'} rows={3}
          value={body} onChange={e => setBody(e.target.value)}
          placeholder={
            type === 'meal' ? 'Ate all of breakfast, good appetite…'
            : type === 'medication' ? 'Gave morning tablet with food…'
            : type === 'walk' ? 'Lovely 30-min walk, lots of energy…'
            : type === 'wellbeing' ? 'Settled and happy, sleeping well…'
            : 'What happened?'} />

        <div className="space-y-1.5">
          <label htmlFor="up-photo" className="block text-sm font-medium text-slate-700">
            Photo {type === 'photo' ? '' : '(optional)'}
          </label>
          <input id="up-photo" type="file" accept="image/*" capture="environment"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50" />
        </div>
      </form>
    </Modal>
  )
}
