import { useState, useEffect } from 'react'
import { Plus, Copy, Check, UserMinus, UserPlus, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card, Button, Input, Select, Modal } from '@/components/ui'
import {
  ROLE_LABELS, ROLE_COLOURS, canManageStaff,
  type StaffRole,
} from '@/lib/roles'
import type { Database } from '@/types/database'

type StaffUser = Database['public']['Tables']['staff_users']['Row']

type PendingInvite = {
  id:         string
  email:      string
  role:       StaffRole
  token:      string
  created_at: string
  expires_at: string
}

const ASSIGNABLE_ROLES: { value: StaffRole; label: string }[] = [
  { value: 'manager',   label: ROLE_LABELS.manager   },
  { value: 'staff',     label: ROLE_LABELS.staff      },
  { value: 'read_only', label: ROLE_LABELS.read_only  },
]

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({
  open,
  onClose,
  onInvited,
}: {
  open:      boolean
  onClose:   () => void
  onInvited: (token: string, email: string) => void
}) {
  const [email,  setEmail]  = useState('')
  const [role,   setRole]   = useState<StaffRole>('staff')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    if (open) { setEmail(''); setRole('staff'); setError(null) }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required'); return }
    setSaving(true); setError(null)
    const { data, error: rpcErr } = await supabase.rpc('create_staff_invite', {
      p_email: email.trim(),
      p_role:  role,
    })
    setSaving(false)
    if (rpcErr) { setError(rpcErr.message); return }
    onInvited(data as string, email.trim())
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite staff member"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="invite-form" type="submit" loading={saving}>Send invite</Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="invite-email"
          label="Email address"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="staff@example.com"
          required
          autoComplete="off"
        />
        <Select
          id="invite-role"
          label="Role"
          value={role}
          onChange={e => setRole(e.target.value as StaffRole)}
        >
          {ASSIGNABLE_ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-600 space-y-1">
          <p><span className="font-semibold">Manager</span> — full access to bookings, pets and settings. Cannot manage staff or billing.</p>
          <p><span className="font-semibold">Staff</span> — day-to-day operations. Cannot cancel bookings, delete records or access settings.</p>
          <p><span className="font-semibold">Read only</span> — view records only, no edits.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  )
}

// ─── Invite link modal ────────────────────────────────────────────────────────

function InviteLinkModal({
  open,
  token,
  email,
  onClose,
}: {
  open:    boolean
  token:   string | null
  email:   string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const link = token ? `${window.location.origin}/join?token=${token}` : ''

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite link created"
      size="sm"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Share this link with <span className="font-medium">{email}</span>. It expires in 7 days.
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 truncate focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
          >
            {copied
              ? <><Check className="w-3.5 h-3.5 text-emerald-600" /><span className="text-emerald-600">Copied</span></>
              : <><Copy className="w-3.5 h-3.5" />Copy</>}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          The invited person will need to sign in (or create an account) to accept.
        </p>
      </div>
    </Modal>
  )
}

// ─── Staff row ────────────────────────────────────────────────────────────────

function StaffRow({
  member,
  isSelf,
  isOwner,
  onRoleChange,
  onActiveChange,
}: {
  member:         StaffUser
  isSelf:         boolean
  isOwner:        boolean
  onRoleChange:   (id: string, role: StaffRole) => Promise<void>
  onActiveChange: (id: string, active: boolean) => Promise<void>
}) {
  const [roleSaving,   setRoleSaving]   = useState(false)
  const [activeSaving, setActiveSaving] = useState(false)
  const [roleError,    setRoleError]    = useState<string | null>(null)

  const initials = `${member.first_name[0] ?? ''}${member.last_name[0] ?? ''}`.toUpperCase() || '?'

  async function handleRoleChange(newRole: StaffRole) {
    setRoleSaving(true); setRoleError(null)
    try { await onRoleChange(member.id, newRole) }
    catch (e: any) { setRoleError(e.message) }
    finally { setRoleSaving(false) }
  }

  async function handleToggle() {
    setActiveSaving(true)
    try { await onActiveChange(member.id, !member.is_active) }
    finally { setActiveSaving(false) }
  }

  return (
    <li className="flex items-center gap-4 px-5 py-3.5">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
        style={{ backgroundColor: member.is_active ? 'var(--brand-primary)' : '#cbd5e1' }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={['text-sm font-medium', member.is_active ? 'text-slate-900' : 'text-slate-400'].join(' ')}>
            {member.first_name} {member.last_name}
            {isSelf && <span className="text-slate-400 font-normal"> (you)</span>}
          </p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOURS[member.role]}`}>
            {ROLE_LABELS[member.role]}
          </span>
          {!member.is_active && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Inactive</span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">{member.email}</p>
        {roleError && <p className="text-xs text-red-600 mt-0.5">{roleError}</p>}
      </div>

      {isOwner && !isSelf && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={member.role}
            onChange={e => handleRoleChange(e.target.value as StaffRole)}
            disabled={roleSaving}
            className="text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="owner">Owner</option>
            {ASSIGNABLE_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <button
            onClick={handleToggle}
            disabled={activeSaving}
            title={member.is_active ? 'Deactivate' : 'Reactivate'}
            className={[
              'p-1.5 rounded-md border transition-colors disabled:opacity-50',
              member.is_active
                ? 'border-red-200 text-red-500 hover:bg-red-50'
                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
            ].join(' ')}
          >
            {member.is_active
              ? <UserMinus className="w-4 h-4" />
              : <UserPlus  className="w-4 h-4" />}
          </button>
        </div>
      )}
    </li>
  )
}

// ─── Pending invite row ───────────────────────────────────────────────────────

function PendingInviteRow({
  invite,
  isOwner,
  onCopyLink,
}: {
  invite:     PendingInvite
  isOwner:    boolean
  onCopyLink: (token: string, email: string) => void
}) {
  const expiresDate = new Date(invite.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <li className="flex items-center gap-4 px-5 py-3.5">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold bg-slate-100 text-slate-400 flex-shrink-0">
        ?
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-600">{invite.email}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOURS[invite.role]}`}>
            {ROLE_LABELS[invite.role]}
          </span>
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Invite pending</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Expires {expiresDate}</p>
      </div>
      {isOwner && (
        <button
          onClick={() => onCopyLink(invite.token, invite.email)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy link
        </button>
      )}
    </li>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { staffUser, isAdmin } = useBusinessContext()

  const [staff,          setStaff]          = useState<StaffUser[]>([])
  const [pendingInvites, setPendingInvites]  = useState<PendingInvite[]>([])
  const [loading,        setLoading]         = useState(true)
  const [inviteOpen,     setInviteOpen]      = useState(false)
  const [linkToken,      setLinkToken]       = useState<string | null>(null)
  const [linkEmail,      setLinkEmail]       = useState('')
  const [linkOpen,       setLinkOpen]        = useState(false)

  const isOwner = isAdmin || (staffUser?.role === 'owner')

  async function load() {
    setLoading(true)
    const [staffRes, inviteRes] = await Promise.all([
      supabase.from('staff_users').select('*').order('first_name').order('last_name'),
      supabase
        .from('staff_invites')
        .select('id, email, role, token, created_at, expires_at')
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ])
    setStaff(staffRes.data ?? [])
    setPendingInvites((inviteRes.data ?? []) as PendingInvite[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleInvited(token: string, email: string) {
    setLinkToken(token)
    setLinkEmail(email)
    setLinkOpen(true)
    load()
  }

  function handleCopyLink(token: string, email: string) {
    setLinkToken(token)
    setLinkEmail(email)
    setLinkOpen(true)
  }

  async function handleRoleChange(id: string, role: StaffRole) {
    const { error } = await supabase.rpc('update_staff_role', { p_staff_id: id, p_new_role: role })
    if (error) throw new Error(error.message)
    setStaff(prev => prev.map(s => s.id === id ? { ...s, role } : s))
  }

  async function handleActiveChange(id: string, active: boolean) {
    const { error } = await supabase.rpc('set_staff_active', { p_staff_id: id, p_active: active })
    if (error) throw new Error(error.message)
    setStaff(prev => prev.map(s => s.id === id ? { ...s, is_active: active } : s))
  }

  const activeStaff   = staff.filter(s =>  s.is_active)
  const inactiveStaff = staff.filter(s => !s.is_active)

  if (!isOwner && !canManageStaff(staffUser?.role ?? 'read_only')) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Staff" backHref="/settings" />
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center">
          <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Only owners can manage staff members.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Staff"
        description={`${activeStaff.length} active member${activeStaff.length !== 1 ? 's' : ''}`}
        backHref="/settings"
        action={
          isOwner && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setInviteOpen(true)}>
              Invite staff
            </Button>
          )
        }
      />

      {loading ? (
        <Card><div className="py-8 text-center text-sm text-slate-400">Loading…</div></Card>
      ) : (
        <>
          {/* Active staff */}
          {activeStaff.length > 0 && (
            <Card padding="none" className="mb-4">
              <ul className="divide-y divide-slate-100">
                {activeStaff.map(member => (
                  <StaffRow
                    key={member.id}
                    member={member}
                    isSelf={member.id === staffUser?.id}
                    isOwner={isOwner}
                    onRoleChange={handleRoleChange}
                    onActiveChange={handleActiveChange}
                  />
                ))}
              </ul>
            </Card>
          )}

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <Card padding="none" className="mb-4">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pending invites</p>
              </div>
              <ul className="divide-y divide-slate-100">
                {pendingInvites.map(invite => (
                  <PendingInviteRow
                    key={invite.id}
                    invite={invite}
                    isOwner={isOwner}
                    onCopyLink={handleCopyLink}
                  />
                ))}
              </ul>
            </Card>
          )}

          {/* Inactive staff */}
          {inactiveStaff.length > 0 && (
            <Card padding="none">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Inactive</p>
              </div>
              <ul className="divide-y divide-slate-100">
                {inactiveStaff.map(member => (
                  <StaffRow
                    key={member.id}
                    member={member}
                    isSelf={member.id === staffUser?.id}
                    isOwner={isOwner}
                    onRoleChange={handleRoleChange}
                    onActiveChange={handleActiveChange}
                  />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={handleInvited}
      />

      <InviteLinkModal
        open={linkOpen}
        token={linkToken}
        email={linkEmail}
        onClose={() => setLinkOpen(false)}
      />
    </div>
  )
}
