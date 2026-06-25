import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { PawPrint, CheckCircle, XCircle, MailCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { signInWithEmail, signUpWithEmail } from '@/lib/auth'

type InviteInfo = {
  business_name: string
  email:         string
  owner_name:    string
  expires_at:    string
  is_valid:      boolean
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'ready';        invite: InviteInfo }
  | { kind: 'confirm-email'; email: string }
  | { kind: 'success';      businessName: string }
  | { kind: 'error';        message: string }

type Mode = 'signup' | 'signin'

export default function PortalJoinPage() {
  const [params]  = useSearchParams()
  const navigate  = useNavigate()
  const { user, signOut } = useAuth()
  const token     = params.get('token') ?? ''

  const [state,     setState]     = useState<PageState>({ kind: 'loading' })
  const [mode,      setMode]      = useState<Mode>('signup')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [busy,      setBusy]      = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setState({ kind: 'invalid' }); return }
    supabase.rpc('get_owner_portal_invite_by_token', { p_token: token }).then(({ data, error }) => {
      const rows = (data ?? []) as unknown as InviteInfo[]
      if (error || rows.length === 0 || !rows[0].is_valid) {
        setState({ kind: 'invalid' })
        return
      }
      setState({ kind: 'ready', invite: rows[0] })
    })
  }, [token])

  const invite = state.kind === 'ready' ? state.invite : null

  async function link(): Promise<boolean> {
    const { error } = await supabase.rpc('accept_owner_portal_invite', { p_token: token })
    if (error) { setState({ kind: 'error', message: error.message }); return false }
    return true
  }

  function finish() {
    setState({ kind: 'success', businessName: invite?.business_name ?? '' })
    setTimeout(() => navigate('/portal', { replace: true }), 1500)
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return
    if (password.length < 8)  { setFormError('Choose a password of at least 8 characters'); return }
    if (password !== confirm) { setFormError('Those passwords don’t match'); return }
    setBusy(true); setFormError(null)
    const { data: session, error } = await signUpWithEmail(invite.email, password)
    if (error) {
      // Account already exists → nudge to sign in
      setFormError(/registered|exists/i.test(error.message)
        ? 'You already have an account — switch to “I already have a password”.'
        : error.message)
      setBusy(false); return
    }
    if (!session) { setBusy(false); setState({ kind: 'confirm-email', email: invite.email }); return }
    const ok = await link()
    setBusy(false)
    if (ok) finish()
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return
    setBusy(true); setFormError(null)
    const { error } = await signInWithEmail(invite.email, password)
    if (error) { setFormError(error.message); setBusy(false); return }
    const ok = await link()
    setBusy(false)
    if (ok) finish()
  }

  async function handleLinkExisting() {
    setBusy(true)
    const ok = await link()
    setBusy(false)
    if (ok) finish()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-sm"
               style={{ backgroundColor: 'var(--brand-primary)' }}>
            <PawPrint className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">PawBoard</h1>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          {state.kind === 'loading' && <p className="text-sm text-slate-500 text-center">Loading your invite…</p>}

          {state.kind === 'invalid' && (
            <div className="text-center space-y-3">
              <XCircle className="w-10 h-10 text-red-400 mx-auto" />
              <h2 className="text-base font-semibold text-slate-900">Invite not found</h2>
              <p className="text-sm text-slate-500">
                This link is invalid, has already been used, or has expired. Ask the kennels to send a new one.
              </p>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="text-center space-y-3">
              <XCircle className="w-10 h-10 text-red-400 mx-auto" />
              <h2 className="text-base font-semibold text-slate-900">Couldn’t link your account</h2>
              <p className="text-sm text-slate-500">{state.message}</p>
            </div>
          )}

          {state.kind === 'confirm-email' && (
            <div className="text-center space-y-3">
              <MailCheck className="w-10 h-10 text-emerald-500 mx-auto" />
              <h2 className="text-base font-semibold text-slate-900">Confirm your email</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                We’ve sent a confirmation link to <span className="font-medium">{state.email}</span>.
                Click it, then open this invite link again to finish.
              </p>
            </div>
          )}

          {state.kind === 'success' && (
            <div className="text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <h2 className="text-base font-semibold text-slate-900">You’re all set!</h2>
              <p className="text-sm text-slate-500">
                Your account is now linked to <span className="font-medium">{state.businessName}</span>. Taking you to your portal…
              </p>
            </div>
          )}

          {state.kind === 'ready' && (
            <div className="space-y-5">
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm space-y-1">
                <p className="font-semibold text-slate-900">{state.invite.business_name}</p>
                <p className="text-slate-600">
                  Owner portal for <span className="font-medium">{state.invite.owner_name}</span>
                </p>
              </div>

              {/* Already signed in as the right person */}
              {user && user.email?.toLowerCase() === state.invite.email.toLowerCase() && (
                <>
                  <p className="text-sm text-slate-600">
                    You’re signed in as <span className="font-medium">{user.email}</span>.
                  </p>
                  <button onClick={handleLinkExisting} disabled={busy}
                    className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: 'var(--brand-primary)' }}>
                    {busy ? 'Linking…' : 'Go to my portal'}
                  </button>
                </>
              )}

              {/* Signed in as someone else */}
              {user && user.email?.toLowerCase() !== state.invite.email.toLowerCase() && (
                <div className="space-y-3">
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    This invite is for <span className="font-medium">{state.invite.email}</span>, but you’re signed in as{' '}
                    <span className="font-medium">{user.email}</span>.
                  </p>
                  <button onClick={() => signOut()}
                    className="w-full py-2.5 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
                    Sign out & continue
                  </button>
                </div>
              )}

              {/* Not signed in → create account (or sign in) with the locked email */}
              {!user && (
                <>
                  <div className="flex rounded-lg border border-slate-200 p-1 gap-1">
                    {(['signup', 'signin'] as Mode[]).map(m => (
                      <button key={m} onClick={() => { setMode(m); setFormError(null) }}
                        className={['flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
                          m === mode ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'].join(' ')}>
                        {m === 'signup' ? 'Set a password' : 'I already have one'}
                      </button>
                    ))}
                  </div>

                  {formError && (
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
                      {formError}
                    </div>
                  )}

                  <form onSubmit={mode === 'signup' ? handleSignUp : handleSignIn} className="space-y-3" noValidate>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                      <input value={state.invite.email} readOnly
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-500 bg-slate-50" />
                    </div>
                    <div>
                      <label htmlFor="pj-pw" className="block text-xs font-medium text-slate-500 mb-1">
                        {mode === 'signup' ? 'Create a password' : 'Password'}
                      </label>
                      <input id="pj-pw" type="password" value={password} onChange={e => setPassword(e.target.value)}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        placeholder="••••••••" required
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-transparent" />
                    </div>
                    {mode === 'signup' && (
                      <div>
                        <label htmlFor="pj-confirm" className="block text-xs font-medium text-slate-500 mb-1">Confirm password</label>
                        <input id="pj-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                          autoComplete="new-password" placeholder="••••••••" required
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-transparent" />
                      </div>
                    )}
                    <button type="submit" disabled={busy}
                      className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                      style={{ backgroundColor: 'var(--brand-primary)' }}>
                      {busy
                        ? 'Please wait…'
                        : mode === 'signup' ? 'Create account & continue' : 'Sign in & continue'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
