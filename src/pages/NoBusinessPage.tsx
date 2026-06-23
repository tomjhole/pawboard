import { PawPrint, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { BusinessState } from '@/context/BusinessContext'

interface Props {
  state: Extract<BusinessState, { status: 'no-staff-record' | 'error' }>
}

export default function NoBusinessPage({ state }: Props) {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mb-3 shadow-sm">
            <PawPrint className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-semibold text-slate-900 tracking-tight">PawBoard</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
            <TriangleAlert className="w-5 h-5 text-amber-500" />
          </div>

          {state.status === 'no-staff-record' ? (
            <>
              <h1 className="text-base font-semibold text-slate-900 mb-2">
                Account not linked to a business
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                Your account hasn't been linked to a business yet. Please ask your manager
                or the business owner to add you as a staff member, then try signing in again.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-base font-semibold text-slate-900 mb-2">
                Something went wrong
              </h1>
              <p className="text-sm text-slate-500 mb-3 leading-relaxed">
                There was a problem loading your business data. Please try signing out and back in.
                If the problem continues, contact support.
              </p>
              <p className="text-xs font-mono text-slate-400 bg-slate-50 rounded-lg px-3 py-2 text-left break-all">
                {state.message}
              </p>
            </>
          )}

          <button
            onClick={signOut}
            className="mt-6 w-full py-2.5 px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
