import type { Database } from '@/types/database'

export type StaffRole = Database['public']['Enums']['staff_role']

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner:     'Owner',
  manager:   'Manager',
  staff:     'Staff',
  read_only: 'Read only',
}

export const ROLE_COLOURS: Record<StaffRole, string> = {
  owner:     'bg-violet-100 text-violet-700',
  manager:   'bg-blue-100 text-blue-700',
  staff:     'bg-emerald-100 text-emerald-700',
  read_only: 'bg-slate-100 text-slate-500',
}

/** Can access /settings/* pages */
export function canAccessSettings(role: StaffRole): boolean {
  return role === 'owner' || role === 'manager'
}

/** Can cancel or delete records */
export function canDestructiveAction(role: StaffRole): boolean {
  return role === 'owner' || role === 'manager'
}

/** Can invite and manage other staff members */
export function canManageStaff(role: StaffRole): boolean {
  return role === 'owner'
}

/** Can create or edit records (not read-only) */
export function canEdit(role: StaffRole): boolean {
  return role !== 'read_only'
}
