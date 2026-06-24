import { Navigate, Outlet } from 'react-router-dom'
import { useBusinessContext } from '@/context/BusinessContext'
import type { StaffRole } from '@/lib/roles'

export default function RequireRole({ allowed }: { allowed: StaffRole[] }) {
  const { staffUser, state, isAdmin } = useBusinessContext()

  if (state.status === 'loading') return null

  // Platform admins pass all role gates
  if (isAdmin) return <Outlet />

  if (!staffUser || !allowed.includes(staffUser.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
