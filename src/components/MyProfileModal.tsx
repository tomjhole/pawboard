import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { Modal, Button, Input } from '@/components/ui'

export default function MyProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { staffUser, reload } = useBusinessContext()

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    if (open && staffUser) {
      setFirstName(staffUser.first_name)
      setLastName(staffUser.last_name)
      setPhone(staffUser.phone ?? '')
      setError(null)
    }
  }, [open, staffUser])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!staffUser) return
    if (!firstName.trim() || !lastName.trim()) { setError('Enter your first and last name.'); return }
    setSaving(true); setError(null)
    const { error: updErr } = await supabase
      .from('staff_users')
      .update({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        phone:      phone.trim() || null,
      })
      .eq('id', staffUser.id)
    setSaving(false)
    if (updErr) { setError(updErr.message); return }
    reload()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="sm"
      title="My profile"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button form="my-profile-form" type="submit" loading={saving}>Save changes</Button>
      </>}
    >
      <form id="my-profile-form" onSubmit={handleSubmit} className="space-y-3" noValidate>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Input id="mp-first" label="First name" required autoFocus
            value={firstName} onChange={e => setFirstName(e.target.value)} />
          <Input id="mp-last" label="Last name" required
            value={lastName} onChange={e => setLastName(e.target.value)} />
        </div>
        <Input id="mp-phone" label="Phone (optional)" type="tel"
          value={phone} onChange={e => setPhone(e.target.value)} />
      </form>
    </Modal>
  )
}
