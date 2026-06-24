import { useState, useEffect, useCallback } from 'react'
import { Plus, CheckCircle, AlertCircle, XCircle, Clock, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { useBusinessContext } from '@/context/BusinessContext'
import { Button, Modal, Input, Textarea } from '@/components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

type Vaccination = {
  id:                string
  vaccination_type:  string
  administered_date: string | null
  expiry_date:       string | null
  is_verified:       boolean
  verified_at:       string | null
  verified_by:       string | null
  is_rejected:       boolean
  rejection_reason:  string | null
}

type VaxStatus =
  | 'verified'
  | 'unverified'
  | 'expiring_soon'
  | 'expires_before_stay'
  | 'expired'
  | 'rejected'

// ─── Vaccination type (from DB) ───────────────────────────────────────────────

type VaccType = {
  id:          string
  name:        string
  species_id:  string | null
  is_critical: boolean
}

// ─── Status logic ─────────────────────────────────────────────────────────────

function getVaxStatus(vax: Vaccination, stayEndDate?: string): VaxStatus {
  if (vax.is_rejected) return 'rejected'
  if (!vax.is_verified) return 'unverified'
  if (!vax.expiry_date) return 'verified'

  const today = new Date(); today.setHours(12, 0, 0, 0)
  const expiry = new Date(vax.expiry_date + 'T12:00:00')

  if (expiry < today) return 'expired'

  if (stayEndDate) {
    const stayEnd = new Date(stayEndDate + 'T12:00:00')
    if (expiry < stayEnd) return 'expires_before_stay'
  }

  const soon = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  if (expiry < soon) return 'expiring_soon'

  return 'verified'
}

const STATUS_CFG: Record<VaxStatus, {
  label: string
  bg: string
  text: string
  border: string
  Icon: React.ElementType
}> = {
  verified:            { label: 'Verified',            bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', Icon: CheckCircle  },
  unverified:          { label: 'Unverified',          bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   Icon: AlertCircle  },
  expiring_soon:       { label: 'Expiring soon',       bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   Icon: Clock        },
  expires_before_stay: { label: 'Expires before stay', bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    Icon: AlertCircle  },
  expired:             { label: 'Expired',             bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    Icon: XCircle      },
  rejected:            { label: 'Rejected',            bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    Icon: XCircle      },
}

function VaxBadge({ status }: { status: VaxStatus }) {
  const c = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      <c.Icon className="w-3 h-3 flex-shrink-0" />
      {c.label}
    </span>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(12, 0, 0, 0)
  return Math.ceil((new Date(iso + 'T12:00:00').getTime() - today.getTime()) / 86400000)
}

// ─── VaccinationModal ─────────────────────────────────────────────────────────

type VaxForm = {
  type:             string
  administeredDate: string
  expiryDate:       string
  isVerified:       boolean
  verifiedBy:       string
  verifiedAt:       string
  isRejected:       boolean
  rejectionReason:  string
}

const EMPTY: VaxForm = {
  type: '', administeredDate: '', expiryDate: '',
  isVerified: false, verifiedBy: '', verifiedAt: '',
  isRejected: false, rejectionReason: '',
}

function VaccinationModal({
  open, petId, businessId, existing, vaccTypes, prefillType, onClose, onSaved,
}: {
  open:        boolean
  petId:       string
  businessId:  string
  existing:    Vaccination | null
  vaccTypes:   VaccType[]
  prefillType: string | null
  onClose:     () => void
  onSaved:     () => void
}) {
  const isEdit = existing !== null
  const [form,   setForm]   = useState<VaxForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm({
        type:             existing.vaccination_type,
        administeredDate: existing.administered_date ?? '',
        expiryDate:       existing.expiry_date        ?? '',
        isVerified:       existing.is_verified,
        verifiedBy:       existing.verified_by        ?? '',
        verifiedAt:       existing.verified_at        ? existing.verified_at.split('T')[0] : '',
        isRejected:       existing.is_rejected,
        rejectionReason:  existing.rejection_reason   ?? '',
      })
    } else {
      setForm({ ...EMPTY, type: prefillType ?? '' })
    }
    setError(null)
    setSaving(false)
  }, [open, existing, prefillType])

  function set<K extends keyof VaxForm>(k: K, v: VaxForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    if (!form.type.trim()) { setError('Vaccination type is required'); return }
    setSaving(true); setError(null)
    const payload = {
      vaccination_type:  form.type.trim(),
      administered_date: form.administeredDate || null,
      expiry_date:       form.expiryDate        || null,
      is_verified:       form.isVerified,
      verified_by:       form.isVerified ? (form.verifiedBy.trim()  || null) : null,
      verified_at:       form.isVerified && form.verifiedAt
                           ? new Date(form.verifiedAt + 'T12:00:00').toISOString()
                           : null,
      is_rejected:       form.isRejected,
      rejection_reason:  form.isRejected ? (form.rejectionReason.trim() || null) : null,
    }
    try {
      if (isEdit) {
        const { error: e } = await supabase.from('vaccinations').update(payload).eq('id', existing!.id)
        if (e) throw e
        if (!existing!.is_verified && payload.is_verified) {
          await logAudit(businessId, {
            action:      'vaccination.verified',
            entity_type: 'vaccination',
            entity_id:   petId,
            after: { vaccination_type: payload.vaccination_type, verified_by: payload.verified_by },
            meta:  { vaccination_id: existing!.id },
          })
        } else {
          await logAudit(businessId, {
            action:      'vaccination.updated',
            entity_type: 'vaccination',
            entity_id:   petId,
            after: { vaccination_type: payload.vaccination_type },
            meta:  { vaccination_id: existing!.id },
          })
        }
      } else {
        const { data: vax, error: e } = await supabase
          .from('vaccinations')
          .insert({ ...payload, pet_id: petId, business_id: businessId })
          .select('id')
          .single()
        if (e) throw e
        await logAudit(businessId, {
          action:      'vaccination.added',
          entity_type: 'vaccination',
          entity_id:   petId,
          after: { vaccination_type: payload.vaccination_type },
          meta:  { vaccination_id: vax.id },
        })
      }
      onSaved(); onClose()
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    setSaving(true)
    await supabase.from('vaccinations').delete().eq('id', existing.id)
    onSaved(); onClose()
  }

  const typeOptions = vaccTypes.length > 0
    ? vaccTypes.map(t => t.name)
    : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit vaccination' : 'Add vaccination'}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          {isEdit ? (
            <Button variant="ghost" onClick={handleDelete} disabled={saving}
              className="text-red-500 hover:text-red-700 hover:bg-red-50">
              Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {isEdit ? 'Save changes' : 'Add vaccination'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="vax-type" className="text-sm font-medium text-slate-700 block">
            Vaccination type <span className="text-red-500">*</span>
          </label>
          <input
            id="vax-type"
            list="vax-type-list"
            value={form.type}
            onChange={e => set('type', e.target.value)}
            placeholder="e.g. Distemper"
            autoComplete="off"
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <datalist id="vax-type-list">
            {typeOptions.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input id="vax-admin" label="Administered" type="date"
            value={form.administeredDate} onChange={e => set('administeredDate', e.target.value)} />
          <Input id="vax-expiry" label="Expiry date" type="date"
            value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
        </div>

        <hr className="border-slate-100" />

        <div className="space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={form.isVerified}
              onChange={e => set('isVerified', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-emerald-600" />
            <span className="text-sm font-medium text-slate-700">Verified by staff</span>
          </label>

          {form.isVerified && (
            <div className="grid grid-cols-2 gap-4 pl-6">
              <Input id="vax-by" label="Verified by" value={form.verifiedBy}
                onChange={e => set('verifiedBy', e.target.value)}
                placeholder="Staff member" autoComplete="off" />
              <Input id="vax-at" label="Verified date" type="date"
                value={form.verifiedAt} onChange={e => set('verifiedAt', e.target.value)} />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={form.isRejected}
              onChange={e => set('isRejected', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-red-600" />
            <span className="text-sm font-medium text-slate-700">Rejected / invalid</span>
          </label>

          {form.isRejected && (
            <div className="pl-6">
              <Textarea id="vax-reason" label="Reason" rows={2}
                value={form.rejectionReason} onChange={e => set('rejectionReason', e.target.value)}
                placeholder="Why was this rejected?" />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── VaccinationCard ──────────────────────────────────────────────────────────

function VaccinationCard({ vax, stayEndDate, onEdit }: {
  vax:          Vaccination
  stayEndDate?: string
  onEdit:       () => void
}) {
  const status = getVaxStatus(vax, stayEndDate)
  const days   = vax.expiry_date ? daysUntil(vax.expiry_date) : null

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-semibold text-slate-900">{vax.vaccination_type}</span>
          <VaxBadge status={status} />
        </div>
        <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
          {vax.administered_date && (
            <span>Administered {fmtDate(vax.administered_date)}</span>
          )}
          {vax.expiry_date && (
            <span>
              Expires {fmtDate(vax.expiry_date)}
              {days !== null && days >= 0 && days <= 60 && (
                <span className={days <= 14 ? ' text-rose-600 font-medium' : ' text-amber-600'}>
                  {' '}(in {days} day{days !== 1 ? 's' : ''})
                </span>
              )}
              {days !== null && days < 0 && (
                <span className=" text-rose-600 font-medium">
                  {' '}({Math.abs(days)} day{Math.abs(days) !== 1 ? 's' : ''} ago)
                </span>
              )}
            </span>
          )}
          {vax.verified_by && <span>Verified by {vax.verified_by}</span>}
          {vax.verified_at && <span>on {fmtDate(vax.verified_at)}</span>}
          {vax.rejection_reason && (
            <span className="text-rose-600">{vax.rejection_reason}</span>
          )}
        </div>
      </div>
      <button onClick={onEdit}
        className="p-1 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0 rounded mt-0.5"
        title="Edit">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── VaccinationsSection (exported) ──────────────────────────────────────────

export function VaccinationsSection({ petId, petSpeciesId, stayEndDate, onIssueCount }: {
  petId:          string
  petSpeciesId?:  string | null
  stayEndDate?:   string
  onIssueCount?:  (n: number) => void
}) {
  const { business } = useBusinessContext()

  const [vaxList,   setVaxList]   = useState<Vaccination[]>([])
  const [vaccTypes, setVaccTypes] = useState<VaccType[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<Vaccination | null>(null)
  const [prefill,   setPrefill]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [vaxRes, typesRes] = await Promise.all([
      supabase
        .from('vaccinations')
        .select('id, vaccination_type, administered_date, expiry_date, is_verified, verified_at, verified_by, is_rejected, rejection_reason')
        .eq('pet_id', petId)
        .order('vaccination_type'),
      business
        ? supabase
            .from('vaccination_types')
            .select('id, name, species_id, is_critical')
            .eq('is_active', true)
            .order('sort_order')
            .order('name')
        : Promise.resolve({ data: [] }),
    ])
    setVaxList((vaxRes.data ?? []) as Vaccination[])
    const allTypes = ((typesRes as any).data ?? []) as VaccType[]
    // Filter to types relevant to this pet's species
    setVaccTypes(allTypes.filter(t => !t.species_id || t.species_id === petSpeciesId))
    setLoading(false)
  }, [petId, business, petSpeciesId])

  useEffect(() => { load() }, [load])

  function openAdd(prefillType?: string) {
    setEditing(null); setPrefill(prefillType ?? null); setModalOpen(true)
  }
  function openEdit(vax: Vaccination) {
    setEditing(vax); setPrefill(null); setModalOpen(true)
  }

  const recordedNames = new Set(vaxList.map(v => v.vaccination_type.toLowerCase()))
  const missingTypes  = vaccTypes.filter(t => !recordedNames.has(t.name.toLowerCase()))
  const missingCritical = missingTypes.filter(t => t.is_critical)
  const missingOptional = missingTypes.filter(t => !t.is_critical)

  const problemCount = vaxList.filter(v => {
    const s = getVaxStatus(v, stayEndDate)
    return s !== 'verified' && s !== 'unverified'
  }).length
  const issueCount = missingCritical.length + problemCount

  useEffect(() => { onIssueCount?.(issueCount) }, [issueCount]) // eslint-disable-line

  return (
    <div className="mt-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <h3 className="text-sm font-semibold text-slate-700 flex-1">
            Vaccinations{vaxList.length > 0 ? ` (${vaxList.length})` : ''}
          </h3>
          {issueCount > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
              {issueCount} issue{issueCount !== 1 ? 's' : ''}
            </span>
          )}
          <Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openAdd()}>
            Add
          </Button>
        </div>

        {/* Missing critical */}
        {missingCritical.length > 0 && (
          <div className="px-4 py-3 bg-rose-50 border-b border-rose-100">
            <p className="text-xs font-semibold text-rose-700 mb-2">Missing critical vaccinations</p>
            <div className="flex flex-wrap gap-2">
              {missingCritical.map(t => (
                <button key={t.id} onClick={() => openAdd(t.name)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 transition-colors">
                  <Plus className="w-3 h-3" />{t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Missing optional */}
        {missingOptional.length > 0 && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
            <p className="text-xs font-semibold text-amber-700 mb-2">Recommended vaccinations not recorded</p>
            <div className="flex flex-wrap gap-2">
              {missingOptional.map(t => (
                <button key={t.id} onClick={() => openAdd(t.name)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 transition-colors">
                  <Plus className="w-3 h-3" />{t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p className="px-4 py-5 text-sm text-slate-400 text-center">Loading…</p>
        ) : vaxList.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-400 italic text-center">No vaccination records yet</p>
        ) : (
          vaxList.map(v => (
            <VaccinationCard key={v.id} vax={v} stayEndDate={stayEndDate} onEdit={() => openEdit(v)} />
          ))
        )}
      </div>

      {business && (
        <VaccinationModal
          open={modalOpen}
          petId={petId}
          businessId={business.id}
          existing={editing}
          vaccTypes={vaccTypes}
          prefillType={prefill}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
