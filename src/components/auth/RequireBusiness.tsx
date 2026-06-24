import { Navigate, Outlet } from 'react-router-dom'
import { useBusinessContext } from '@/context/BusinessContext'
import LoadingState from '@/components/ui/LoadingState'
import NoBusinessPage from '@/pages/NoBusinessPage'
import ThemeApplicator from '@/components/ThemeApplicator'

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
    return isAdmin
      ? <Navigate to="/admin" replace />
      : <Navigate to="/onboarding" replace />
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
