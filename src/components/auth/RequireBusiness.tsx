import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBusinessContext } from '@/context/BusinessContext'
import LoadingState from '@/components/ui/LoadingState'
import NoBusinessPage from '@/pages/NoBusinessPage'
import ThemeApplicator from '@/components/ThemeApplicator'

// A signed-in user with no staff record might still be a linked portal owner.
// Resolve that before defaulting to onboarding.
function NoStaffRedirect({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth()
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) { setTarget('/admin'); return }
    if (!user)   { setTarget('/login'); return }
    supabase
      .from('owners')
      .select('id')
      .eq('portal_user_id', user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setTarget(data ? '/portal' : '/onboarding'))
  }, [isAdmin, user])

  if (!target) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingState message="Loading your account…" />
      </div>
    )
  }
  return <Navigate to={target} replace />
}

export default function RequireBusiness() {
  const { state, isAdmin } = useBusinessContext()

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingState message="Loading your account…" />
      </div>
    )
  }

  if (state.status === 'no-staff-record') {
    return <NoStaffRedirect isAdmin={isAdmin} />
  }

  if (state.status === 'error') {
    return <NoBusinessPage state={state} />
  }

  return (
    <>
      <ThemeApplicator />
      <Outlet />
    </>
  )
}
