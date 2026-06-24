import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, Clock, XCircle, FileUp, Paperclip } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '@/context/PortalContext'
import { Card, Button, Input, Textarea } from '@/components/ui'
import { fmtDate } from './shared'

type PortalPet = {
  id: string
  name: string
  breed: string | null
  sex: string
  size: string | null
  date_of_birth: string | null
  colour_markings: string | null
  microchip_number: string | null
  feeding_instructions: string | null
  behaviour_notes: string | null
  medical_notes: string | null
  vet_practice_name: string | null
  vet_name: string | null
  vet_phone: string | null
  vet_address: string | null
  insurance_provider: string | null
  insurance_policy_number: string | null
  species: { name: string | null; icon: string | null; colour: string | null } | null
}

type Vax = {
  id: string
  vaccination_type: string
  administered_date: string | null
  expiry_date: string | null
  is_verified: boolean
  is_rejected: boolean
  rejection_reason: string | null
  document_url: string | null
}

type EditForm = {
  feeding_instructions: string
  behaviour_notes: string
  medical_notes: string
  microchip_number: string
  vet_practice_name: string
  vet_name: string
  vet_phone: string
  insurance_provider: string
  insurance_policy_number: string
}

function blankForm(p: PortalPet): EditForm {
  return {
    feeding_instructions:    p.feeding_instructions ?? '',
    behaviour_notes:         p.behaviour_notes ?? '',
    medical_notes:           p.medical_notes ?? '',
    microchip_number:        p.microchip_number ?? '',
    vet_practice_name:       p.vet_practice_name ?? '',
    vet_name:                p.vet_name ?? '',
    vet_phone:               p.vet_phone ?? '',
    insurance_provider:      p.insurance_provider ?? '',
    insurance_policy_number: p.insurance_policy_number ?? '',
  }
}

function VaxStatus({ v }: { v: Vax }) {
  const expired = v.expiry_date ? new Date(v.expiry_date) < new Date() : false
  if (v.is_rejected) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
        <XCircle className="w-3.5 h-3.5" /> Rejected
      </span>
    )
  }
  if (v.is_verified) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${expired ? 'text-amber-600' : 'text-emerald-600'}`}>
        <ShieldCheck className="w-3.5 h-3.5" /> {expired ? 'Verified · expired' : 'Verified'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
      <Clock className="w-3.5 h-3.5" /> Awaiting review
    </span>
  )
}

function ReadRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-4 py-1.5">
      <dt className="text-sm text-slate-500 w-36 flex-shrink-0">{label}</dt>
      <dd className="text-sm text-slate-900 min-w-0 break-words whitespace-pre-wrap">{value}</dd>
    </div>
  )
}

export default function PortalPetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { owner, settings } = usePortal()
  const canEdit = settings?.portal_allow_pet_edits ?? false
  const canDocs = settings?.portal_allow_documents ?? false

  const [pet,     setPet]     = useState<PortalPet | null>(null)
  const [vax,     setVax]     = useState<Vax[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState<EditForm | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [petRes, vaxRes] = await Promise.all([
      supabase.from('pets')
        .select('id, name, breed, sex, size, date_of_birth, colour_markings, microchip_number, feeding_instructions, behaviour_notes, medical_notes, vet_practice_name, vet_name, vet_phone, vet_address, insurance_provider, insurance_policy_number, species:species_id ( name, icon, colour )')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('vaccinations')
        .select('id, vaccination_type, administered_date, expiry_date, is_verified, is_rejected, rejection_reason, document_url')
        .eq('pet_id', id)
        .order('created_at', { ascending: false }),
    ])
    if (!petRes.data) { setNotFound(true); setLoading(false); return }
    setPet(petRes.data as unknown as PortalPet)
    setVax((vaxRes.data ?? []) as unknown as Vax[])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function startEdit() {
    if (!pet) return
    setForm(blankForm(pet))
    setSaveError(null)
    setEditing(true)
  }

  async function handleSave() {
    if (!pet || !form) return
    setSaving(true); setSaveError(null)
    const { error } = await supabase.from('pets').update({
      feeding_instructions:    form.feeding_instructions.trim() || null,
      behaviour_notes:         form.behaviour_notes.trim() || null,
      medical_notes:           form.medical_notes.trim() || null,
      microchip_number:        form.microchip_number.trim() || null,
      vet_practice_name:       form.vet_practice_name.trim() || null,
      vet_name:                form.vet_name.trim() || null,
      vet_phone:               form.vet_phone.trim() || null,
      insurance_provider:      form.insurance_provider.trim() || null,
      insurance_policy_number: form.insurance_policy_number.trim() || null,
    }).eq('id', pet.id)
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setEditing(false)
    await load()
  }

  if (loading) return <p className="text-sm text-slate-400 py-10 text-center">Loading…</p>
  if (notFound || !pet) {
    return (
      <div>
        <Link to="/portal/pets" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to pets
        </Link>
        <Card><p className="text-sm text-slate-500 text-center py-6">Pet not found.</p></Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link to="/portal/pets" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="w-4 h-4" /> Back to pets
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 select-none"
          style={{ backgroundColor: pet.species?.colour ? `${pet.species.colour}20` : '#f1f5f9' }}>
          {pet.species?.icon ?? '🐾'}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pet.name}</h1>
          <p className="text-sm text-slate-500">{[pet.species?.name, pet.breed].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      {/* Care & details */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Care & details</h2>
          {canEdit && !editing && (
            <Button size="sm" variant="secondary" onClick={startEdit}>Edit</Button>
          )}
        </div>

        {editing && form ? (
          <div className="px-5 py-4 space-y-3">
            {saveError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{saveError}</div>}
            <Textarea id="feeding" label="Feeding instructions" rows={2}
              value={form.feeding_instructions} onChange={e => setForm({ ...form, feeding_instructions: e.target.value })} />
            <Textarea id="behaviour" label="Behaviour notes" rows={2}
              value={form.behaviour_notes} onChange={e => setForm({ ...form, behaviour_notes: e.target.value })} />
            <Textarea id="medical" label="Medical notes" rows={2}
              value={form.medical_notes} onChange={e => setForm({ ...form, medical_notes: e.target.value })} />
            <Input id="microchip" label="Microchip number"
              value={form.microchip_number} onChange={e => setForm({ ...form, microchip_number: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input id="vet-practice" label="Vet practice"
                value={form.vet_practice_name} onChange={e => setForm({ ...form, vet_practice_name: e.target.value })} />
              <Input id="vet-phone" label="Vet phone"
                value={form.vet_phone} onChange={e => setForm({ ...form, vet_phone: e.target.value })} />
              <Input id="vet-name" label="Vet name"
                value={form.vet_name} onChange={e => setForm({ ...form, vet_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input id="ins-provider" label="Insurance provider"
                value={form.insurance_provider} onChange={e => setForm({ ...form, insurance_provider: e.target.value })} />
              <Input id="ins-policy" label="Policy number"
                value={form.insurance_policy_number} onChange={e => setForm({ ...form, insurance_policy_number: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save changes</Button>
            </div>
          </div>
        ) : (
          <dl className="px-5 py-3">
            <ReadRow label="Sex" value={pet.sex !== 'unknown' ? pet.sex : null} />
            <ReadRow label="Date of birth" value={pet.date_of_birth ? fmtDate(pet.date_of_birth) : null} />
            <ReadRow label="Colour / markings" value={pet.colour_markings} />
            <ReadRow label="Microchip" value={pet.microchip_number} />
            <ReadRow label="Feeding" value={pet.feeding_instructions} />
            <ReadRow label="Behaviour" value={pet.behaviour_notes} />
            <ReadRow label="Medical" value={pet.medical_notes} />
            <ReadRow label="Vet practice" value={pet.vet_practice_name} />
            <ReadRow label="Vet phone" value={pet.vet_phone} />
            <ReadRow label="Insurance" value={[pet.insurance_provider, pet.insurance_policy_number].filter(Boolean).join(' · ') || null} />
            {!pet.feeding_instructions && !pet.behaviour_notes && !pet.medical_notes && !pet.vet_practice_name && (
              <p className="text-sm text-slate-400 italic py-2">No extra details recorded yet.{canEdit ? ' Tap Edit to add some.' : ''}</p>
            )}
          </dl>
        )}
      </Card>

      {/* Vaccinations & documents */}
      <Card padding="none">
        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Vaccinations & documents</h2>
          <p className="text-xs text-slate-500 mt-0.5">Uploads are reviewed by the kennels before they’re marked verified.</p>
        </div>

        {vax.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400 italic">No vaccination records yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {vax.map(v => (
              <li key={v.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{v.vaccination_type}</p>
                    <p className="text-xs text-slate-500">
                      {v.expiry_date ? `Expires ${fmtDate(v.expiry_date)}` : 'No expiry recorded'}
                    </p>
                    {v.is_rejected && v.rejection_reason && (
                      <p className="text-xs text-rose-600 mt-0.5">{v.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {v.document_url && (
                      <a href={v.document_url} target="_blank" rel="noreferrer"
                        className="text-slate-400 hover:text-slate-600" title="View document">
                        <Paperclip className="w-4 h-4" />
                      </a>
                    )}
                    <VaxStatus v={v} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {canDocs && (
          <div className="px-5 py-4 border-t border-slate-100">
            <UploadForm petId={pet.id} businessId={owner!.business_id} onUploaded={load} />
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Upload form ────────────────────────────────────────────────────────────

function UploadForm({ petId, businessId, onUploaded }: { petId: string; businessId: string; onUploaded: () => void }) {
  const [open,    setOpen]    = useState(false)
  const [type,    setType]    = useState('')
  const [expiry,  setExpiry]  = useState('')
  const [file,    setFile]    = useState<File | null>(null)
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!type.trim()) { setError('Enter what the document is (e.g. “Annual booster”).'); return }
    if (!file)        { setError('Choose a file to upload.'); return }
    setBusy(true); setError(null)
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `documents/${petId}/${Date.now()}-${safe}`
      const up = await supabase.storage.from('pets').upload(path, file, { upsert: false })
      if (up.error) throw new Error(up.error.message)
      const { data: { publicUrl } } = supabase.storage.from('pets').getPublicUrl(path)
      const ins = await supabase.from('vaccinations').insert({
        pet_id:           petId,
        business_id:      businessId,
        vaccination_type: type.trim(),
        expiry_date:      expiry || null,
        document_url:     publicUrl,
        is_verified:      false,
      })
      if (ins.error) throw new Error(ins.error.message)
      setOpen(false); setType(''); setExpiry(''); setFile(null)
      onUploaded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" icon={<FileUp className="w-3.5 h-3.5" />} onClick={() => setOpen(true)}>
        Upload a document
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
      <Input id="doc-type" label="What is it?" placeholder="e.g. Annual booster certificate" required
        value={type} onChange={e => setType(e.target.value)} />
      <Input id="doc-expiry" label="Expiry date (optional)" type="date"
        value={expiry} onChange={e => setExpiry(e.target.value)} />
      <div className="space-y-1.5">
        <label htmlFor="doc-file" className="block text-sm font-medium text-slate-700">File</label>
        <input id="doc-file" type="file" accept="image/*,application/pdf"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" type="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        <Button type="submit" loading={busy}>Upload</Button>
      </div>
    </form>
  )
}
