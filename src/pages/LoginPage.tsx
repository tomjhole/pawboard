import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { PawPrint } from 'lucide-react'
import { signInWithEmail, signUpWithEmail } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'

type Mode = 'signin' | 'signup'

function Field({
  id, label, type = 'text', value, onChange, placeholder, autoComplete, disabled,
}: {
  id: string; label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string
  autoComplete?: string; disabled?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required autoComplete={autoComplete} disabled={disabled}
        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow disabled:opacity-50 disabled:bg-slate-50"
      />
    </div>
  )
}

export default function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, loading } = useAuth()

  const [mode,     setMode]     = useState<Mode>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [busy,     setBusy]     = useState(false)
  const [signedUp, setSignedUp] = useState(false)

  if (!loading && user) return <Navigate to="/calendar" replace />

  function switchMode(next: Mode) {
    setMode(next); setError(null); setPassword(''); setConfirm('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup') {
      if (password.length < 8) { setError('Password must be at least 8 characters'); return }
      if (password !== confirm) { setError('Passwords do not match'); return }
    }

    setBusy(true)

    if (mode === 'signin') {
      const { error } = await signInWithEmail(email, password)
      if (error) { setError(error.message); setBusy(false); return }
      const from = (location.state as any)?.from
      navigate(from ? `${from.pathname}${from.search ?? ''}` : '/calendar', { replace: true })
    } else {
      const { data: session, error } = await signUpWithEmail(email, password)
      if (error) { setError(error.message); setBusy(false); return }
      if (session) {
        // Auto-confirmed — go straight to onboarding
        navigate('/onboarding', { replace: true })
      } else {
        // Email confirmation required
        setSignedUp(true)
      }
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-sm"
               style={{ backgroundColor: 'var(--brand-primary)' }}>
            <PawPrint className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">PawBoard</h1>
          <p className="text-slate-500 text-sm mt-1">The modern visual booking diary</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          {signedUp ? (
            // Email confirmation screen
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                <PawPrint className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                We've sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back here to sign in.
              </p>
              <button
                onClick={() => { setSignedUp(false); switchMode('signin') }}
                className="mt-5 text-sm font-medium underline"
                style={{ color: 'var(--brand-primary)' }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex rounded-lg border border-slate-200 p-1 mb-5 gap-1">
                {(['signin', 'signup'] as Mode[]).map(m => (
                  <button key={m} onClick={() => switchMode(m)}
                    className={['flex-1 py-1.5 text-sm font-medium rounded-md transition-colors', m === mode ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'].join(' ')}>
                    {m === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field id="email" label="Email address" type="email" value={email} onChange={setEmail}
                  placeholder="you@yourkennels.co.uk" autoComplete="email" disabled={busy} />
                <Field id="password" label="Password" type="password" value={password} onChange={setPassword}
                  placeholder="••••••••" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} disabled={busy} />
                {mode === 'signup' && (
                  <Field id="confirm" label="Confirm password" type="password" value={confirm} onChange={setConfirm}
                    placeholder="••••••••" autoComplete="new-password" disabled={busy} />
                )}

                <button type="submit" disabled={busy}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors mt-2 flex items-center justify-center gap-2">
                  {busy ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
                    </>
                  ) : mode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              {mode === 'signup' && (
                <p className="text-xs text-slate-400 text-center mt-4 leading-relaxed">
                  After creating your account you'll set up your business details.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
