import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type BookingUpdate = Database['public']['Tables']['bookings']['Update']

export type Payment = Database['public']['Tables']['payments']['Row']
export type PaymentMethod = 'cash' | 'bank_transfer' | 'stripe'
export type PaymentKind   = 'deposit' | 'balance' | 'full' | 'other' | 'refund'

export function paidTotal(payments: Payment[]): number {
  return payments
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount), 0)
}

/** Deposit amount for a total, given the business config. value = percent or fixed amount. */
export function depositAmount(total: number, depositType: string, depositValue: number): number {
  const dep = depositType === 'fixed' ? depositValue : Math.round(total * depositValue) / 100
  return Math.max(0, Math.round(dep * 100) / 100)
}

export async function loadOutstanding(bookingId: string): Promise<{ total: number | null; paid: number; outstanding: number }> {
  const [{ data: b }, { data: rows }] = await Promise.all([
    supabase.from('bookings').select('total_amount').eq('id', bookingId).maybeSingle(),
    supabase.from('payments').select('amount').eq('booking_id', bookingId).eq('status', 'paid'),
  ])
  const total = b?.total_amount ?? null
  const paid  = (rows ?? []).reduce((s, r) => s + Number((r as { amount: number }).amount), 0)
  return { total, paid, outstanding: total != null ? Math.max(0, total - paid) : 0 }
}

/** Recompute and persist deposit_paid / balance_paid flags on a booking after a payment. */
export async function syncBookingPaymentFlags(bookingId: string, kind: PaymentKind): Promise<void> {
  const [{ data: booking }, { data: rows }] = await Promise.all([
    supabase.from('bookings').select('total_amount').eq('id', bookingId).maybeSingle(),
    supabase.from('payments').select('amount').eq('booking_id', bookingId).eq('status', 'paid'),
  ])
  const paid  = (rows ?? []).reduce((s, r) => s + Number((r as { amount: number }).amount), 0)
  const total = Number(booking?.total_amount ?? 0)
  const update: BookingUpdate = {}
  if (kind === 'deposit') {
    update.deposit_paid = true
    update.deposit_paid_at = new Date().toISOString()
  }
  if (total > 0 && paid >= total - 0.001) {
    update.deposit_paid = true
    update.balance_paid = true
    update.balance_paid_at = new Date().toISOString()
  }
  if (Object.keys(update).length > 0) {
    await supabase.from('bookings').update(update).eq('id', bookingId)
  }
}

/** Kicks off Stripe Checkout via the Edge Function and redirects on success. */
export async function startCardCheckout(bookingId: string, kind: 'deposit' | 'balance' | 'full'): Promise<{ error?: string }> {
  const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
    body: { booking_id: bookingId, kind, origin: window.location.origin },
  })
  if (error) {
    let msg = error.message ?? 'Could not start checkout'
    try {
      const ctx = (error as unknown as { context?: Response }).context
      const j = ctx ? await ctx.json() : null
      if (j?.error) msg = j.error
    } catch { /* ignore */ }
    return { error: msg }
  }
  if (data?.error) return { error: data.error }
  if (data?.url)   { window.location.href = data.url as string; return {} }
  return { error: 'No checkout URL was returned.' }
}
