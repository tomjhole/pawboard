import { useState, useEffect } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { CheckCircle, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '@/context/PortalContext'
import { Card, Button, Input, Textarea } from '@/components/ui'
import { notify } from '@/lib/notify'
import { todayIso, nights } from './shared'

type SelPet = { id: string; name: string; species: { icon: string | null } | null }

export default function PortalRequestBookingPage() {
  const { owner, settings } = usePortal()
  const navigate = useNavigate()

  const [pets,     setPets]     = useState<SelPet[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [start,    setStart]    = useState('')
  const [end,      setEnd]      = useState('')
  const [notes,    setNotes]    = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [busy,     setBusy]     = useState(false)
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    if (!owner) return
    supabase.from('pets')
      .select('id, name, species:species_id ( icon )')
      .eq('owner_id', owner.id).eq('is_active', true).order('name')
      .then(({ data }) => setPets((data ?? []) as unknown as SelPet[]))
  }, [owner])

  // Feature turned off → bounce home
  if (settings && !settings.portal_allow_booking_requests) {
    return <Navigate to="/portal" replace />
  }

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!owner) return
    if (selected.size === 0) { setError('Choose at least one pet.'); return }
    if (!start || !end)      { setError('Choose your arrival and collection dates.'); return }
    if (end < start)         { setError('The collection date must be on or after the arrival date.'); return }
    if (start < todayIso())  { setError('The arrival date can’t be in the past.'); return }

    setBusy(true); setError(null)
    try {
      const { data: booking, error: bErr } = await supabase.from('bookings').insert({
        business_id: owner.business_id,
        owner_id:    owner.id,
        status:      'enquiry',
        start_date:  start,
        end_date:    end,
        source:      'portal',
        notes:       notes.trim() || null,
      }).select('id').single()
      if (bErr || !booking) throw new Error(bErr?.message ?? 'Could not create the request')

      const rows = [...selected].map(petId => ({
        booking_id:  booking.id,
        pet_id:      petId,
        business_id: owner.business_id,
      }))
      const { error: bpErr } = await supabase.from('booking_pets').insert(rows)
      if (bpErr) throw new Error(bpErr.message)

      notify('booking_request_received', { businessId: owner.business_id, relatedId: booking.id })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto text-center py-8">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-slate-900">Request sent</h1>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          We’ve sent your request to the kennels. They’ll confirm availability and get back to you —
          you’ll see it update on your home screen.
        </p>
        <div className="flex justify-center gap-2 mt-5">
          <Button variant="secondary" onClick={() => { setDone(false); setSelected(new Set()); setStart(''); setEnd(''); setNotes('') }}>
            Request another
          </Button>
          <Button onClick={() => navigate('/portal')}>Back to home</Button>
        </div>
      </div>
    )
  }

  const n = start && end && end >= start ? nights(start, end) : 0

  return (
    <div className="space-y-4">
      <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="w-4 h-4" /> Back
      </Link>
      <h1 className="text-xl font-bold text-slate-900">Request a stay</h1>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        <Card>
          <p className="text-sm font-medium text-slate-700 mb-2">Which pets?</p>
          {pets.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No pets on record. Contact the kennels to add your pets first.</p>
          ) : (
            <div className="space-y-2">
              {pets.map(p => {
                const on = selected.has(p.id)
                return (
                  <button key={p.id} type="button" onClick={() => toggle(p.id)}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                      on ? 'border-transparent' : 'border-slate-200 hover:border-slate-300',
                    ].join(' ')}
                    style={on ? { borderColor: 'var(--brand-primary)', backgroundColor: 'color-mix(in srgb, var(--brand-primary) 6%, white)' } : {}}>
                    <span className="text-lg">{p.species?.icon ?? '🐾'}</span>
                    <span className="text-sm font-medium text-slate-900 flex-1">{p.name}</span>
                    <span className={[
                      'w-4 h-4 rounded border flex items-center justify-center text-[10px] text-white',
                      on ? '' : 'border-slate-300',
                    ].join(' ')} style={on ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)' } : {}}>
                      {on ? '✓' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="start" label="Arrival date" type="date" required min={todayIso()}
              value={start} onChange={e => setStart(e.target.value)} />
            <Input id="end" label="Collection date" type="date" required min={start || todayIso()}
              value={end} onChange={e => setEnd(e.target.value)} />
          </div>
          {n > 0 && <p className="text-xs text-slate-500 mt-2">{n} night{n === 1 ? '' : 's'}</p>}
          <div className="mt-3">
            <Textarea id="notes" label="Anything we should know? (optional)" rows={3}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Special requests, medication, feeding changes…" />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={busy} disabled={pets.length === 0}>Send request</Button>
        </div>
        <p className="text-xs text-slate-400 text-center">
          This is a request, not a confirmed booking — the kennels will confirm availability.
        </p>
      </form>
    </div>
  )
}
