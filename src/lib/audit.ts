import { supabase } from '@/lib/supabase'

export type AuditAction =
  | 'booking.created'
  | 'booking.updated'
  | 'booking.status_changed'
  | 'booking.checked_in'
  | 'booking.checked_out'
  | 'space_assignment.changed'
  | 'pet.created'
  | 'pet.updated'
  | 'owner.updated'
  | 'vaccination.added'
  | 'vaccination.updated'
  | 'vaccination.verified'
  | 'space.created'
  | 'space.updated'

interface AuditEntry {
  action:      AuditAction
  entity_type: string
  entity_id:   string
  before?:     Record<string, unknown> | null
  after?:      Record<string, unknown> | null
  meta?:       Record<string, unknown> | null
}

export async function logAudit(businessId: string, entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_log').insert({
      business_id: businessId,
      user_id:     user?.id    ?? null,
      actor_label: user?.email ?? null,
      action:      entry.action,
      entity_type: entry.entity_type,
      entity_id:   entry.entity_id,
      before:      entry.before ?? null,
      after:       entry.after  ?? null,
      meta:        entry.meta   ?? null,
    })
  } catch {
    // audit failures must never break the calling action
  }
}
