import { useState } from 'react'
import { usePortal } from '@/context/PortalContext'
import { supabase } from '@/lib/supabase'
import { Card, Button, Input } from '@/components/ui'

export default function PortalProfilePage() {
  const { owner, reload } = usePortal()

  const [form, setForm] = useState(() => ({
    phone:           owner?.phone ?? '',
    phone_secondary: owner?.phone_secondary ?? '',
    address_line1:   owner?.address_line1 ?? '',
    address_line2:   owner?.address_line2 ?? '',
    city:            owner?.city ?? '',
    postcode:        owner?.postcode ?? '',
    emergency_contact_name:         owner?.emergency_contact_name ?? '',
    emergency_contact_phone:        owner?.emergency_contact_phone ?? '',
    emergency_contact_relationship: owner?.emergency_contact_relationship ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  if (!owner) return null

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setSaved(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.phone.trim()) { setError('A contact phone number is required.'); return }
    setSaving(true); setError(null)
    const { error } = await supabase.from('owners').update({
      phone:           form.phone.trim(),
      phone_secondary: form.phone_secondary.trim() || null,
      address_line1:   form.address_line1.trim() || null,
      address_line2:   form.address_line2.trim() || null,
      city:            form.city.trim() || null,
      postcode:        form.postcode.trim() || null,
      emergency_contact_name:         form.emergency_contact_name.trim() || null,
      emergency_contact_phone:        form.emergency_contact_phone.trim() || null,
      emergency_contact_relationship: form.emergency_contact_relationship.trim() || null,
    }).eq('id', owner!.id)
    setSaving(false)
    if (error) { setError(error.message); return }
    setSaved(true)
    reload()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">My details</h1>

      <form onSubmit={save} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        <Card>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Account</p>
          <div className="flex gap-4 py-1.5">
            <span className="text-sm text-slate-500 w-32 flex-shrink-0">Name</span>
            <span className="text-sm text-slate-900">{owner.first_name} {owner.last_name}</span>
          </div>
          <div className="flex gap-4 py-1.5">
            <span className="text-sm text-slate-500 w-32 flex-shrink-0">Email</span>
            <span className="text-sm text-slate-900">{owner.email ?? '—'}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">To change your name or email, please contact the kennels.</p>
        </Card>

        <Card>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Contact</p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input id="phone" label="Phone" required value={form.phone} onChange={e => set('phone', e.target.value)} />
              <Input id="phone2" label="Second phone" value={form.phone_secondary} onChange={e => set('phone_secondary', e.target.value)} />
            </div>
            <Input id="addr1" label="Address line 1" value={form.address_line1} onChange={e => set('address_line1', e.target.value)} />
            <Input id="addr2" label="Address line 2" value={form.address_line2} onChange={e => set('address_line2', e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input id="city" label="Town / City" value={form.city} onChange={e => set('city', e.target.value)} />
              <Input id="postcode" label="Postcode" value={form.postcode} onChange={e => set('postcode', e.target.value)} />
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Emergency contact</p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input id="ec-name" label="Name" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} />
              <Input id="ec-phone" label="Phone" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} />
            </div>
            <Input id="ec-rel" label="Relationship" value={form.emergency_contact_relationship} onChange={e => set('emergency_contact_relationship', e.target.value)} />
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
          <Button type="submit" loading={saving}>Save details</Button>
        </div>
      </form>
    </div>
  )
}
