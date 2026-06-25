import { supabase } from '@/lib/supabase'

// Automatic + on-demand email types handled by the send-email Edge Function.
export type NotifyType =
  | 'booking_confirmation'
  | 'booking_changed'
  | 'booking_cancelled'
  | 'payment_receipt'
  | 'invoice'
  | 'portal_invite'
  | 'booking_request_received'

export type NotifyResult = { ok: boolean; sent: boolean; reason?: string }

interface NotifyArgs {
  businessId: string
  /** The entity the email is about — usually a booking id (owner id for invites). */
  relatedId?: string
  /** Extra context for the template / behaviour, e.g. { payment_id }, { force: true }. */
  extra?: Record<string, unknown>
}

/**
 * Email request. Never throws — a failed or unconfigured send can't break the
 * action that triggered it (mirrors logAudit). The Edge Function decides the
 * recipient/content server-side and honours the business's notification
 * toggles. Automatic callers can ignore the promise; on-demand buttons can
 * await the result to show "Emailed" / a reason it didn't send.
 */
export async function notify(type: NotifyType, args: NotifyArgs): Promise<NotifyResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type,
        business_id: args.businessId,
        related_id:  args.relatedId ?? null,
        extra:       args.extra ?? null,
        origin:      window.location.origin,
      },
    })
    if (error) {
      let reason = error.message
      try {
        const ctx = (error as unknown as { context?: Response }).context
        const j = ctx ? await ctx.json() : null
        if (j?.error) reason = j.error
      } catch { /* ignore */ }
      return { ok: false, sent: false, reason }
    }
    return { ok: true, sent: !!data?.sent, reason: data?.reason }
  } catch {
    return { ok: false, sent: false, reason: 'Could not reach the email service.' }
  }
}
