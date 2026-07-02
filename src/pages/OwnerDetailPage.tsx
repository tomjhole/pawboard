import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Pencil, Trash2, CheckCircle, AlertCircle, ChevronRight, Plus, Globe, Copy, Check, Mail } from 'lucide-react'
import { notify } from '@/lib/notify'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card, Button } from '@/components/ui'
import { OwnerModal, type OwnerForm } from '@/pages/OwnersPage'
import { PetModal, buildPetPayload, type PetForm } from '@/pages/PetsPage'
import { logAudit } from '@/lib/audit'
import { canDestructiveAction, canEdit as canEditRole } from '@/lib/roles'
import type { Database } from '@/types/database'

type Owner   = Database['public']['Tables']['owners']['Row']
type Species = Database['public']['Tables']['species']['Row']

type OwnerPet = {
  id:       string
  name:     string
  breed:    string | null
  is_active: boolean
  species:  Pick<Species, 'id' | 'name' | 'icon' | 'colour'> | null
}

function PortalAccessCard({ owner, canManage, portalEnabled, businessName, businessId }: {
  owner: Owner
  canManage: boolean
  portalEnabled: boolean
  businessName: string
  businessId: string
}) {
  const [link, setLink]   = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'link' | 'message' | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMsg,  setEmailMsg]  = useState<string | null>(null)

  const isLinked = !!owner.portal_user_id

  const message = link
    ? `Hi ${owner.first_name},\n\n`
      + `You can now manage your pets with ${businessName} online — view their details, upload vaccination certificates and request stays.\n\n`
      + `Get started here:\n${link}\n\n`
      + `When prompted, set a password for ${owner.email} and you'll be taken straight in.`
    : ''

  async function invite() {
    setBusy(true); setError(null)
    const { data, error } = await supabase.rpc('create_owner_portal_invite', { p_owner_id: owner.id })
    setBusy(false)
    if (error) { setError(error.message); return }
    setToken(data as string)
    setLink(`${window.location.origin}/portal/join?token=${data}`)
  }

  async function emailInvite() {
    setEmailBusy(true); setEmailMsg(null); setError(null)
    let t = token
    if (!t) {
      const { data, error } = await supabase.rpc('create_owner_portal_invite', { p_owner_id: owner.id })
      if (error) { setError(error.message); setEmailBusy(false); return }
      t = data as string
      setToken(t)
      setLink(`${window.location.origin}/portal/join?token=${t}`)
    }
    const r = await notify('portal_invite', { businessId, relatedId: owner.id, extra: { token: t, force: true } })
    setEmailBusy(false)
    setEmailMsg(r.sent ? `Invite emailed to ${owner.email}` : (r.reason ?? 'Could not send the email.'))
  }

  async function copy(what: 'link' | 'message') {
    await navigator.clipboard.writeText(what === 'link' ? link! : message)
    setCopied(what)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Owner portal</h3>
      <Card>
        {isLinked ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            This owner has an active portal account.
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <Globe className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
              <p>
                Invite this owner to the portal so they can view their pets, upload documents and request stays.
              </p>
            </div>

            {!portalEnabled && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                The owner portal is currently turned off — enable it in Settings → Owner portal for invites to work.
              </div>
            )}

            {error && (
              <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            {canManage && !link && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {owner.email ? (
                  <>
                    <Button size="sm" icon={<Mail className="w-3.5 h-3.5" />} onClick={emailInvite} loading={emailBusy}>
                      Email invite to {owner.first_name}
                    </Button>
                    <Button size="sm" variant="secondary" icon={<Globe className="w-3.5 h-3.5" />} onClick={invite} loading={busy}>
                      Get a link instead
                    </Button>
                    {emailMsg && <span className="text-xs text-slate-500">{emailMsg}</span>}
                  </>
                ) : (
                  <Button size="sm" disabled icon={<Globe className="w-3.5 h-3.5" />}>Add an email address first</Button>
                )}
              </div>
            )}

            {link && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-500">
                  Send this to {owner.first_name}. They open it, set a password for <span className="font-medium">{owner.email}</span>, and they’re straight in — no separate sign-up needed.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={link}
                    onFocus={e => e.currentTarget.select()}
                    className="flex-1 min-w-0 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                  />
                  <Button size="sm" variant="secondary" onClick={() => copy('link')}
                    icon={copied === 'link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}>
                    {copied === 'link' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-slate-400">Or copy a ready-to-send message with instructions:</span>
                  <Button size="sm" variant="ghost" onClick={() => copy('message')}
                    icon={copied === 'message' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}>
                    {copied === 'message' ? 'Copied' : 'Copy message'}
                  </Button>
                </div>
                {owner.email && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" icon={<Mail className="w-3.5 h-3.5" />} onClick={emailInvite} loading={emailBusy}>
                      Email it to {owner.first_name}
                    </Button>
                    {emailMsg && <span className="text-xs text-slate-500">{emailMsg}</span>}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</p>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-4 py-1.5">
      <dt className="text-sm text-slate-500 w-40 flex-shrink-0">{label}</dt>
      <dd className="text-sm text-slate-900 min-w-0 break-words">{value}</dd>
    </div>
  )
}

export default function OwnerDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { business, settings, staffUser, isAdmin } = useBusinessContext()
  const canDestruct = isAdmin || canDestructiveAction(staffUser?.role ?? 'read_only')
  const canEdit     = isAdmin || canEditRole(staffUser?.role ?? 'read_only')

  const [owner,         setOwner]         = useState<Owner | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [notFound,      setNotFound]      = useState(false)
  const [editOpen,      setEditOpen]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)

  const [pets,        setPets]        = useState<OwnerPet[]>([])
  const [allSpecies,  setAllSpecies]  = useState<Species[]>([])
  const [addPetOpen,  setAddPetOpen]  = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    const [ownerRes, speciesRes] = await Promise.all([
      supabase.from('owners').select('*').eq('id', id).single(),
      supabase.from('species').select('*').order('is_system_default', { ascending: false }).order('sort_order').order('name'),
    ])
    if (ownerRes.error || !ownerRes.data) {
      setNotFound(true)
    } else {
      setOwner(ownerRes.data)
    }
    setAllSpecies(speciesRes.data ?? [])
    setLoading(false)
  }

  async function loadPets(ownerId: string) {
    const { data } = await supabase
      .from('pets')
      .select('id, name, breed, is_active, species:species_id ( id, name, icon, colour )')
      .eq('owner_id', ownerId)
      .order('name')
    setPets((data ?? []) as OwnerPet[])
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { if (owner) loadPets(owner.id) }, [owner?.id])

  async function handleSave(form: OwnerForm, ownerId: string | null) {
    if (!ownerId) return
    const { error } = await supabase
      .from('owners')
      .update({
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
      })
      .eq('id', ownerId)
    if (error) throw new Error(error.message)
    await logAudit(business!.id, {
      action:      'owner.updated',
      entity_type: 'owner',
      entity_id:   ownerId,
      after: { name: `${form.firstName.trim()} ${form.lastName.trim()}` },
    })
    await load()
  }

  async function handleAddPet(form: PetForm, _id: string | null) {
    if (!owner || !business) return
    const { error } = await supabase
      .from('pets')
      .insert({ ...buildPetPayload(form), business_id: business.id, owner_id: owner.id, is_active: true })
    if (error) throw new Error(error.message)
    await loadPets(owner.id)
  }

  async function handleDelete() {
    if (!owner) return
    setDeleting(true)
    const { error } = await supabase.from('owners').delete().eq('id', owner.id)
    if (error) {
      alert(
        error.code === '23503'
          ? 'This owner has pets or bookings linked to them. Remove those first.'
          : error.message
      )
      setDeleting(false)
      setConfirmDelete(false)
      return
    }
    navigate('/owners')
  }

  if (loading) {
    return (
      <div className="max-w-2xl px-5 py-8 text-sm text-slate-400 text-center">
        Loading…
      </div>
    )
  }

  if (notFound || !owner) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Owner not found" backHref="/owners" />
        <p className="text-sm text-slate-500">This owner record could not be found.</p>
      </div>
    )
  }

  const hasAddress  = !!(owner.address_line1 || owner.city || owner.postcode)
  const hasEmergency = !!owner.emergency_contact_name

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`${owner.first_name} ${owner.last_name}`}
        backHref="/owners"
        action={
          confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Delete this owner?</span>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>
                Yes, delete
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </Button>
            </div>
          ) : !canEdit ? undefined : (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Pencil className="w-3.5 h-3.5" />}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
              {canDestruct && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => setConfirmDelete(true)}
                  className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                  Delete
                </Button>
              )}
            </div>
          )
        }
      />

      <Card>
        <dl>
          {/* Contact */}
          <SectionHeader title="Contact" />
          <InfoRow label="Phone"           value={owner.phone} />
          <InfoRow label="Secondary phone" value={owner.phone_secondary} />
          <InfoRow label="Email"           value={owner.email} />

          {/* Address */}
          {hasAddress && (
            <>
              <hr className="border-slate-100 my-4" />
              <SectionHeader title="Address" />
              <InfoRow label="Address line 1" value={owner.address_line1} />
              <InfoRow label="Address line 2" value={owner.address_line2} />
              <InfoRow label="Town / City"    value={owner.city} />
              <InfoRow label="Postcode"       value={owner.postcode} />
            </>
          )}

          {/* Emergency contact */}
          {hasEmergency && (
            <>
              <hr className="border-slate-100 my-4" />
              <SectionHeader title="Emergency contact" />
              <InfoRow label="Name"         value={owner.emergency_contact_name} />
              <InfoRow label="Relationship" value={owner.emergency_contact_relationship} />
              <InfoRow label="Phone"        value={owner.emergency_contact_phone} />
              <div className="flex gap-4 py-1.5">
                <dt className="text-sm text-slate-500 w-40 flex-shrink-0">Authorise vet</dt>
                <dd className={[
                  'text-sm flex items-center gap-1.5',
                  owner.emergency_contact_can_authorise_vet ? 'text-emerald-600' : 'text-slate-400',
                ].join(' ')}>
                  {owner.emergency_contact_can_authorise_vet
                    ? <><CheckCircle className="w-4 h-4" /> Yes — can authorise treatment</>
                    : 'No'
                  }
                </dd>
              </div>
            </>
          )}

          {/* Notes */}
          {owner.notes && (
            <>
              <hr className="border-slate-100 my-4" />
              <SectionHeader title="Notes" />
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {owner.notes}
              </p>
            </>
          )}

          {/* Inactive warning */}
          {!owner.is_active && (
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              This owner is marked as inactive
            </div>
          )}
        </dl>
      </Card>

      {/* Owner portal access */}
      <PortalAccessCard
        owner={owner}
        canManage={canDestruct}
        portalEnabled={!!settings?.portal_enabled}
        businessName={business?.name ?? 'us'}
        businessId={business?.id ?? ''}
      />

      {/* Pets section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Pets
            {pets.length > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-400">({pets.length})</span>
            )}
          </h3>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setAddPetOpen(true)}
          >
            Add pet
          </Button>
        </div>
        <Card padding="none">
          {pets.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400 italic">No pets recorded for this owner.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pets.map(pet => (
                <li key={pet.id}>
                  <Link
                    to={`/pets/${pet.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 select-none"
                      style={{ backgroundColor: pet.species?.colour ? `${pet.species.colour}20` : '#f1f5f9' }}
                    >
                      {pet.species?.icon ?? '🐾'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {pet.name}
                        {!pet.is_active && (
                          <span className="ml-2 text-xs text-slate-400">(inactive)</span>
                        )}
                      </p>
                      {pet.breed && (
                        <p className="text-xs text-slate-500">{pet.breed}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <OwnerModal
        open={editOpen}
        initialOwner={owner}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
      />

      <PetModal
        open={addPetOpen}
        initialPet={null}
        owners={[{ id: owner.id, first_name: owner.first_name, last_name: owner.last_name }]}
        allSpecies={allSpecies}
        defaultOwnerId={owner.id}
        onClose={() => setAddPetOpen(false)}
        onSave={handleAddPet}
      />
    </div>
  )
}
