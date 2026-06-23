import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Pencil, Trash2, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card, Button } from '@/components/ui'
import { PetModal, buildPetPayload, SIZE_LABELS, type PetWithRelations, type PetForm } from '@/pages/PetsPage'
import type { Database } from '@/types/database'

type Owner   = Database['public']['Tables']['owners']['Row']
type Species = Database['public']['Tables']['species']['Row']

function SectionHeader({ title }: { title: string }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</p>
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-4 py-1.5">
      <dt className="text-sm text-slate-500 w-44 flex-shrink-0">{label}</dt>
      <dd className="text-sm text-slate-900 min-w-0 break-words">{value}</dd>
    </div>
  )
}

function NoteBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <>
      <hr className="border-slate-100 my-4" />
      <SectionHeader title={label} />
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{value}</p>
    </>
  )
}

function formatDob(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return iso
  }
}

function calcAge(iso: string): string {
  const dob = new Date(iso + 'T12:00:00')
  const now = new Date()
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth())
  if (now.getDate() < dob.getDate()) months--
  if (months < 1)  return 'Less than a month old'
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} old`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m === 0 ? `${y} year${y !== 1 ? 's' : ''} old` : `${y} yr ${m} mo old`
}

export default function PetDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { business } = useBusinessContext()

  const [pet,          setPet]          = useState<PetWithRelations | null>(null)
  const [owners,       setOwners]       = useState<Pick<Owner, 'id' | 'first_name' | 'last_name'>[]>([])
  const [allSpecies,   setAllSpecies]   = useState<Species[]>([])
  const [loading,      setLoading]      = useState(true)
  const [notFound,     setNotFound]     = useState(false)
  const [editOpen,     setEditOpen]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,     setDeleting]     = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    const [petRes, ownersRes, speciesRes] = await Promise.all([
      supabase
        .from('pets')
        .select(`
          *,
          owner:owner_id ( id, first_name, last_name ),
          species:species_id ( id, name, plural_name, icon, colour )
        `)
        .eq('id', id)
        .single(),
      supabase.from('owners').select('id, first_name, last_name').order('last_name').order('first_name'),
      supabase.from('species').select('*').order('is_system_default', { ascending: false }).order('sort_order').order('name'),
    ])
    if (petRes.error || !petRes.data) {
      setNotFound(true)
    } else {
      setPet(petRes.data as PetWithRelations)
    }
    setOwners(ownersRes.data ?? [])
    setAllSpecies(speciesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleSave(form: PetForm, petId: string | null) {
    if (!petId) return
    const { error } = await supabase
      .from('pets')
      .update(buildPetPayload(form))
      .eq('id', petId)
    if (error) throw new Error(error.message)
    await load()
  }

  async function handleDelete() {
    if (!pet) return
    setDeleting(true)
    const { error } = await supabase.from('pets').delete().eq('id', pet.id)
    if (error) {
      alert(
        error.code === '23503'
          ? 'This pet is linked to one or more bookings. Remove those first.'
          : error.message
      )
      setDeleting(false)
      setConfirmDelete(false)
      return
    }
    navigate('/pets')
  }

  if (loading) {
    return <div className="max-w-2xl px-5 py-8 text-sm text-slate-400 text-center">Loading…</div>
  }

  if (notFound || !pet) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Pet not found" backHref="/pets" />
        <p className="text-sm text-slate-500">This pet record could not be found.</p>
      </div>
    )
  }

  const species = pet.species
  const owner   = pet.owner

  const hasVet      = !!(pet.vet_practice_name || pet.vet_name || pet.vet_phone || pet.vet_address)
  const hasInsurance = !!(pet.insurance_provider || pet.insurance_policy_number)

  const sexLabel: Record<string, string> = { male: 'Male', female: 'Female', unknown: 'Unknown' }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={pet.name}
        backHref="/pets"
        action={
          confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Delete {pet.name}?</span>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>Yes, delete</Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button
                variant="secondary" size="sm"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => setConfirmDelete(true)}
                className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                Delete
              </Button>
            </div>
          )
        }
      />

      {/* Photo */}
      {pet.photo_url && (
        <div className="mb-5 rounded-xl overflow-hidden">
          <img src={pet.photo_url} alt={pet.name} className="w-full h-52 object-cover" />
        </div>
      )}

      <Card>
        <dl>
          {/* About */}
          <SectionHeader title="About" />

          {species && (
            <div className="flex gap-4 py-1.5">
              <dt className="text-sm text-slate-500 w-44 flex-shrink-0">Species</dt>
              <dd className="text-sm text-slate-900 flex items-center gap-1.5">
                {species.icon && <span>{species.icon}</span>}
                {species.name}
              </dd>
            </div>
          )}

          <InfoRow label="Breed"           value={pet.breed} />
          <InfoRow label="Sex"             value={sexLabel[pet.sex] ?? pet.sex} />

          {pet.is_neutered !== null && (
            <div className="flex gap-4 py-1.5">
              <dt className="text-sm text-slate-500 w-44 flex-shrink-0">Neutered / spayed</dt>
              <dd className={['text-sm flex items-center gap-1.5', pet.is_neutered ? 'text-slate-900' : 'text-slate-900'].join(' ')}>
                {pet.is_neutered ? <><CheckCircle className="w-4 h-4 text-emerald-500" /> Yes</> : 'No'}
              </dd>
            </div>
          )}

          {pet.date_of_birth && (
            <div className="flex gap-4 py-1.5">
              <dt className="text-sm text-slate-500 w-44 flex-shrink-0">Date of birth</dt>
              <dd className="text-sm text-slate-900">
                {formatDob(pet.date_of_birth)}
                <span className="text-slate-400 ml-2">({calcAge(pet.date_of_birth)})</span>
              </dd>
            </div>
          )}

          {pet.size && (
            <InfoRow label="Size" value={SIZE_LABELS[pet.size]} />
          )}

          <InfoRow label="Colour / markings" value={pet.colour_markings} />
          <InfoRow label="Microchip number"  value={pet.microchip_number} />

          {/* Owner */}
          {owner && (
            <>
              <hr className="border-slate-100 my-4" />
              <SectionHeader title="Owner" />
              <div className="flex gap-4 py-1.5">
                <dt className="text-sm text-slate-500 w-44 flex-shrink-0">Name</dt>
                <dd className="text-sm">
                  <Link
                    to={`/owners/${owner.id}`}
                    className="text-slate-900 hover:underline"
                    style={{ color: 'var(--brand-primary)' }}
                  >
                    {owner.first_name} {owner.last_name}
                  </Link>
                </dd>
              </div>
            </>
          )}

          {/* Vet */}
          {hasVet && (
            <>
              <hr className="border-slate-100 my-4" />
              <SectionHeader title="Vet details" />
              <InfoRow label="Practice"     value={pet.vet_practice_name} />
              <InfoRow label="Vet name"     value={pet.vet_name} />
              <InfoRow label="Phone"        value={pet.vet_phone} />
              <InfoRow label="Address"      value={pet.vet_address} />
            </>
          )}

          {/* Insurance */}
          {hasInsurance && (
            <>
              <hr className="border-slate-100 my-4" />
              <SectionHeader title="Insurance" />
              <InfoRow label="Provider"      value={pet.insurance_provider} />
              <InfoRow label="Policy number" value={pet.insurance_policy_number} />
            </>
          )}

          {/* Care notes */}
          <NoteBlock label="Medical notes"       value={pet.medical_notes} />
          <NoteBlock label="Behaviour notes"     value={pet.behaviour_notes} />
          <NoteBlock label="Feeding instructions" value={pet.feeding_instructions} />

          {/* Inactive warning */}
          {!pet.is_active && (
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              This pet is marked as inactive
            </div>
          )}
        </dl>
      </Card>

      <PetModal
        open={editOpen}
        initialPet={pet}
        owners={owners}
        allSpecies={allSpecies}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
