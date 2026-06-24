import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { PawPrint, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { ROLE_LABELS, type StaffRole } from '@/lib/roles'

type InviteInfo = {
  business_name: string
  email:         string
  role:          StaffRole
  expires_at:    string
  is_valid:      boolean
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'already_member' }
  | { kind: 'ready';   invite: InviteInfo }
  | { kind: 'success'; businessName: string }
  | { kind: 'error';   message: string }

export default function JoinPage() {
  const [params]         = useSearchParams()
  const navigate         = useNavigate()
  const { reload }       = useBusinessContext()
  const token            = params.get('token') ?? ''

  const [state,      setState]      = useState<PageState>({ kind: 'loading' })
  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [formErrors, setFormErrors] = useState<{ first?: string; last?: string }>({})

  useEffect(() => {
    if (!token) { setState({ kind: 'invalid' }); return }

    supabase.rpc('get_invite_by_token', { p_token: token }).then(({ data, error }) => {
      if (error || !data || (data as InviteInfo[]).length === 0) {
        setState({ kind: 'invalid' })
        return
      }
      const invite = (data as InviteInfo[])[0]
      if (!invite.is_valid) {
        setState({ kind: 'invalid' })
        return
      }
      setState({ kind: 'ready', invite })
    })
  }, [token])

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof formErrors = {}
    if (!firstName.trim()) errs.first = 'First name is required'
    if (!lastName.trim())  errs.last  = 'Last name is required'
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }

    setSaving(true)
    const { error } = await supabase.rpc('accept_staff_invite', {
      p_token:      token,
      p_first_name: firstName.trim(),
      p_last_name:  lastName.trim(),
    })
    setSaving(false)

    if (error) {
      if (error.message.includes('already have access')) {
        setState({ kind: 'already_member' })
        return
      }
      setState({ kind: 'error', message: error.message })
      return
    }

    const invite = (state as any).invite as InviteInfo
    setState({ kind: 'success', businessName: invite.business_name })
    reload()
    setTimeout(() => navigate('/calendar', { replace: true }), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-sm"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <PawPrint className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">PawBoard</h1>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">

          {state.kind === 'loading' && (
            <p className="text-sm text-slate-500 text-center">Loading invite…</p>
          )}

          {state.kind === 'invalid' && (
            <div className="text-center space-y-3">
              <XCircle className="w-10 h-10 text-red-400 mx-auto" />
              <h2 className="text-base font-semibold text-slate-900">Invite not found</h2>
              <p className="text-sm text-slate-500">
                This invite link is invalid, has already been used, or has expired.
                Ask the business owner to send a new invite.
              </p>
            </div>
          )}

          {state.kind === 'already_member' && (
            <div className="text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <h2 className="text-base font-semibold text-slate-900">Already a member</h2>
              <p className="text-sm text-slate-500">You already have access to this business.</p>
              <button
                onClick={() => navigate('/calendar', { replace: true })}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                Go to PawBoard
              </button>
            </div>
          )}

          {state.kind === 'success' && (
            <div className="text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <h2 className="text-base font-semibold text-slate-900">You're in!</h2>
              <p className="text-sm text-slate-500">
                Welcome to <span className="font-medium">{state.businessName}</span>. Redirecting you now…
              </p>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="text-center space-y-3">
              <XCircle className="w-10 h-10 text-red-400 mx-auto" />
              <h2 className="text-base font-semibold text-slate-900">Something went wrong</h2>
              <p className="text-sm text-slate-500">{state.message}</p>
              <button
                onClick={() => navigate('/calendar', { replace: true })}
                className="w-full py-2.5 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Go to PawBoard
              </button>
            </div>
          )}

          {state.kind === 'ready' && (
            <form onSubmit={handleAccept} className="space-y-5" noValidate>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm space-y-1">
                <p className="font-semibold text-slate-900">{state.invite.business_name}</p>
                <p className="text-slate-600">
                  You've been invited as <span className="font-medium">{ROLE_LABELS[state.invite.role]}</span>
                </p>
              </div>

              <div>
                <label htmlFor="ji-first" className="block text-sm font-medium text-slate-700 mb-1.5">First name</label>
                <input
                  id="ji-first"
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                />
                {formErrors.first && <p className="text-xs text-red-600 mt-1">{formErrors.first}</p>}
              </div>

              <div>
                <label htmlFor="ji-last" className="block text-sm font-medium text-slate-700 mb-1.5">Last name</label>
                <input
                  id="ji-last"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                />
                {formErrors.last && <p className="text-xs text-red-600 mt-1">{formErrors.last}</p>}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {saving ? 'Joining…' : 'Accept invite'}
              </button>

              <p className="text-xs text-slate-400 text-center">
                Invite sent to <span className="font-medium">{state.invite.email}</span>
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
