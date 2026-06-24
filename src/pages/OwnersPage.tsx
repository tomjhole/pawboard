import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronRight, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card, Button, Input, Textarea, Modal, EmptyState } from '@/components/ui'
import type { Database } from '@/types/database'

type Owner = Database['public']['Tables']['owners']['Row']

export interface OwnerForm {
  firstName:                string
  lastName:                 string
  phone:                    string
  phoneSecondary:           string
  email:                    string
  addressLine1:             string
  addressLine2:             string
  city:                     string
  postcode:                 string
  emergencyName:            string
  emergencyPhone:           string
  emergencyRelationship:    string
  emergencyCanAuthoriseVet: boolean
  notes:                    string
}

const EMPTY_FORM: OwnerForm = {
  firstName: '', lastName: '', phone: '', phoneSecondary: '', email: '',
  addressLine1: '', addressLine2: '', city: '', postcode: '',
  emergencyName: '', emergencyPhone: '', emergencyRelationship: '',
  emergencyCanAuthoriseVet: false, notes: '',
}

interface FormErrors {
  firstName?: string
  lastName?:  string
  phone?:     string
}

// ─── Owner modal (add / edit) ──────────────────────────────────────────────

export function OwnerModal({
  open,
  initialOwner,
  onClose,
  onSave,
}: {
  open:         boolean
  initialOwner: Owner | null
  onClose:      () => void
  onSave:       (form: OwnerForm, id: string | null) => Promise<void>
}) {
  const isEdit = initialOwner !== null

  const [form,        setForm]        = useState<OwnerForm>(EMPTY_FORM)
  const [errors,      setErrors]      = useState<FormErrors>({})
  const [saving,      setSaving]      = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (initialOwner) {
      setForm({
        firstName:                initialOwner.first_name,
        lastName:                 initialOwner.last_name,
        phone:                    initialOwner.phone,
        phoneSecondary:           initialOwner.phone_secondary ?? '',
        email:                    initialOwner.email ?? '',
        addressLine1:             initialOwner.address_line1 ?? '',
        addressLine2:             initialOwner.address_line2 ?? '',
        city:                     initialOwner.city ?? '',
        postcode:                 initialOwner.postcode ?? '',
        emergencyName:            initialOwner.emergency_contact_name ?? '',
        emergencyPhone:           initialOwner.emergency_contact_phone ?? '',
        emergencyRelationship:    initialOwner.emergency_contact_relationship ?? '',
        emergencyCanAuthoriseVet: initialOwner.emergency_contact_can_authorise_vet,
        notes:                    initialOwner.notes ?? '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
    setServerError(null)
  }, [open, initialOwner])

  function set<K extends keyof OwnerForm>(k: K, v: OwnerForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    if (k === 'firstName' && errors.firstName) setErrors(p => ({ ...p, firstName: undefined }))
    if (k === 'lastName'  && errors.lastName)  setErrors(p => ({ ...p, lastName: undefined }))
    if (k === 'phone'     && errors.phone)     setErrors(p => ({ ...p, phone: undefined }))
  }

  function validate() {
    const errs: FormErrors = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required.'
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required.'
    if (!form.phone.trim())     errs.phone     = 'Phone number is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setServerError(null)
    try {
      await onSave(form, initialOwner?.id ?? null)
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit owner' : 'Add owner'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="owner-form" type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Add owner'}
          </Button>
        </>
      }
    >
      <form id="owner-form" onSubmit={handleSubmit} className="space-y-5" noValidate>

        {/* ── Personal details ────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Personal details</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="owner-first-name"
              label="First name"
              value={form.firstName}
              onChange={e => set('firstName', e.target.value)}
              error={errors.firstName}
              required
              autoComplete="given-name"
            />
            <Input
              id="owner-last-name"
              label="Last name"
              value={form.lastName}
              onChange={e => set('lastName', e.target.value)}
              error={errors.lastName}
              required
              autoComplete="family-name"
            />
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Contact ─────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contact</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="owner-phone"
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              error={errors.phone}
              required
              autoComplete="tel"
            />
            <Input
              id="owner-phone-secondary"
              label="Secondary phone"
              type="tel"
              value={form.phoneSecondary}
              onChange={e => set('phoneSecondary', e.target.value)}
              autoComplete="tel"
            />
          </div>
          <Input
            id="owner-email"
            label="Email"
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            autoComplete="email"
          />
        </div>

        <hr className="border-slate-100" />

        {/* ── Address ─────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Address</p>
          <Input
            id="owner-addr1"
            label="Address line 1"
            value={form.addressLine1}
            onChange={e => set('addressLine1', e.target.value)}
            autoComplete="address-line1"
          />
          <Input
            id="owner-addr2"
            label="Address line 2"
            value={form.addressLine2}
            onChange={e => set('addressLine2', e.target.value)}
            autoComplete="address-line2"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="owner-city"
              label="Town / City"
              value={form.city}
              onChange={e => set('city', e.target.value)}
              autoComplete="address-level2"
            />
            <Input
              id="owner-postcode"
              label="Postcode"
              value={form.postcode}
              onChange={e => set('postcode', e.target.value)}
              autoComplete="postal-code"
            />
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* ── Emergency contact ───────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Emergency contact</p>
            <button
              type="button"
              onClick={() => {
                set('emergencyName',         `${form.firstName.trim()} ${form.lastName.trim()}`.trim())
                set('emergencyPhone',        form.phone)
                set('emergencyRelationship', 'Self')
              }}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Same as owner
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="owner-ec-name"
              label="Contact name"
              value={form.emergencyName}
              onChange={e => set('emergencyName', e.target.value)}
            />
            <Input
              id="owner-ec-relationship"
              label="Relationship"
              value={form.emergencyRelationship}
              onChange={e => set('emergencyRelationship', e.target.value)}
              placeholder="e.g. Spouse, Parent"
            />
          </div>
          <Input
            id="owner-ec-phone"
            label="Contact phone"
            type="tel"
            value={form.emergencyPhone}
            onChange={e => set('emergencyPhone', e.target.value)}
          />
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.emergencyCanAuthoriseVet}
              onChange={e => set('emergencyCanAuthoriseVet', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700">
              This contact can authorise veterinary treatment
            </span>
          </label>
        </div>

        <hr className="border-slate-100" />

        {/* ── Notes ───────────────────────────────────── */}
        <Textarea
          id="owner-notes"
          label="Notes"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          placeholder="Any additional notes about this owner…"
        />

        {serverError && (
          <p className="text-sm text-red-600" role="alert">{serverError}</p>
        )}
      </form>
    </Modal>
  )
}

// ─── Owner row ────────────────────────────────────────────────────────────

function OwnerRow({ owner }: { owner: Owner }) {
  const navigate = useNavigate()
  const initials = `${owner.first_name[0] ?? ''}${owner.last_name[0] ?? ''}`.toUpperCase()

  return (
    <li>
      <button
        className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
        onClick={() => navigate(`/owners/${owner.id}`)}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 select-none"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {owner.first_name} {owner.last_name}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {owner.phone}
            {owner.email ? ` · ${owner.email}` : ''}
          </p>
        </div>
        {!owner.is_active && (
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 flex-shrink-0">
            Inactive
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
      </button>
    </li>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function OwnersPage() {
  const { business } = useBusinessContext()

  const [owners,    setOwners]    = useState<Owner[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('owners')
      .select('*')
      .order('last_name')
      .order('first_name')
    setOwners(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(form: OwnerForm) {
    const { error } = await supabase
      .from('owners')
      .insert({
        business_id:                         business!.id,
        first_name:                          form.firstName.trim(),
        last_name:                           form.lastName.trim(),
        phone:                               form.phone.trim(),
        phone_secondary:                     form.phoneSecondary.trim()        || null,
        email:                               form.email.trim()                 || null,
        address_line1:                       form.addressLine1.trim()          || null,
        address_line2:                       form.addressLine2.trim()          || null,
        city:                                form.city.trim()                  || null,
        postcode:                            form.postcode.trim()              || null,
        emergency_contact_name:              form.emergencyName.trim()         || null,
        emergency_contact_phone:             form.emergencyPhone.trim()        || null,
        emergency_contact_relationship:      form.emergencyRelationship.trim() || null,
        emergency_contact_can_authorise_vet: form.emergencyCanAuthoriseVet,
        notes:                               form.notes.trim()                 || null,
        is_active:                           true,
      })
    if (error) throw new Error(error.message)
    await load()
  }

  const term = search.toLowerCase().trim()
  const filtered = useMemo(() => {
    if (!term) return owners
    return owners.filter(o =>
      `${o.first_name} ${o.last_name}`.toLowerCase().includes(term) ||
      o.phone.toLowerCase().includes(term) ||
      (o.email ?? '').toLowerCase().includes(term)
    )
  }, [owners, term])

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Owners"
        description="Customer and household records"
        action={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
            Add owner
          </Button>
        }
      />

      {!loading && owners.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone or email…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      )}

      <Card padding="none">
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-400 text-center">Loading…</div>
        ) : owners.length === 0 ? (
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title="No owners yet"
            description="Add your first owner to get started. You can always fill in the full details later."
            action={
              <Button variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>
                Add owner
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-500">
              No owners match <span className="font-medium">"{search}"</span>
            </p>
            <button
              onClick={() => setSearch('')}
              className="text-xs text-slate-400 hover:text-slate-600 mt-1.5 transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map(owner => (
              <OwnerRow key={owner.id} owner={owner} />
            ))}
          </ul>
        )}
      </Card>

      <OwnerModal
        open={modalOpen}
        initialOwner={null}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
