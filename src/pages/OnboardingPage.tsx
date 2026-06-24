import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PawPrint } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBusinessContext } from '@/context/BusinessContext'
import { Input, Button } from '@/components/ui'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export default function OnboardingPage() {
  const { user, signOut } = useAuth()
  const { reload } = useBusinessContext()
  const navigate = useNavigate()

  const [businessName, setBusinessName] = useState('')
  const [firstName,    setFirstName]    = useState('')
  const [lastName,     setLastName]     = useState('')
  const [phone,        setPhone]        = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const slug = slugify(businessName)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim()) { setError('Business name is required'); return }
    if (!firstName.trim())    { setError('Your first name is required'); return }
    if (!lastName.trim())     { setError('Your last name is required'); return }
    if (!slug)                { setError('Business name must contain at least one letter or number'); return }

    setSaving(true); setError(null)

    const { error: rpcError } = await supabase.rpc('create_business_and_owner', {
      p_name:       businessName.trim(),
      p_slug:       slug,
      p_first_name: firstName.trim(),
      p_last_name:  lastName.trim(),
      p_email:      user?.email ?? '',
      p_phone:      phone.trim() || null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setSaving(false)
      return
    }

    reload()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mb-3 shadow-sm">
            <PawPrint className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-semibold text-slate-900 tracking-tight">PawBoard</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Set up your business</h1>
          <p className="text-sm text-slate-500 mb-6">
            You're almost in. Fill in a few details and you'll be ready to go.
          </p>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              id="ob-business"
              label="Business name"
              required
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="Oakwood Kennels"
              autoFocus
              autoComplete="organization"
            />

            {businessName && slug && (
              <p className="text-xs text-slate-400 -mt-2">
                Your URL slug will be: <span className="font-mono text-slate-600">{slug}</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="ob-first"
                label="Your first name"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Jane"
                autoComplete="given-name"
              />
              <Input
                id="ob-last"
                label="Last name"
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Smith"
                autoComplete="family-name"
              />
            </div>

            <Input
              id="ob-phone"
              label="Phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+44 7700 900000"
              autoComplete="tel"
            />

            <div className="pt-2">
              <Button type="submit" className="w-full" loading={saving}>
                Create my business
              </Button>
            </div>
          </form>
        </div>

        <p className="text-center mt-4 text-sm text-slate-400">
          Signed in as {user?.email} ·{' '}
          <button onClick={signOut} className="underline hover:text-slate-600">Sign out</button>
        </p>
      </div>
    </div>
  )
}
