import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '@/context/PortalContext'
import { Card } from '@/components/ui'

type PortalPet = {
  id: string
  name: string
  breed: string | null
  sex: string
  date_of_birth: string | null
  species: { name: string | null; icon: string | null; colour: string | null } | null
}

function ageLabel(dob: string | null): string | null {
  if (!dob) return null
  const months = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 12) return `${months} mo`
  const y = Math.floor(months / 12)
  return `${y} yr${y === 1 ? '' : 's'}`
}

export default function PortalPetsPage() {
  const { owner } = usePortal()
  const [pets,    setPets]    = useState<PortalPet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!owner) return
    supabase
      .from('pets')
      .select('id, name, breed, sex, date_of_birth, species:species_id ( name, icon, colour )')
      .eq('owner_id', owner.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setPets((data ?? []) as unknown as PortalPet[])
        setLoading(false)
      })
  }, [owner])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">My pets</h1>

      {loading ? (
        <Card><p className="text-sm text-slate-400 py-4 text-center">Loading…</p></Card>
      ) : pets.length === 0 ? (
        <Card><p className="text-sm text-slate-400 py-4 text-center italic">No pets on record yet. Contact the kennels to add your pets.</p></Card>
      ) : (
        <div className="space-y-2.5">
          {pets.map(p => {
            const age = ageLabel(p.date_of_birth)
            return (
              <Link key={p.id} to={`/portal/pets/${p.id}`}>
                <Card padding="sm" className="hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 select-none"
                      style={{ backgroundColor: p.species?.colour ? `${p.species.colour}20` : '#f1f5f9' }}>
                      {p.species?.icon ?? '🐾'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {[p.species?.name, p.breed, age].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
