import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type BookingUpdate = Database['public']['Tables']['bookings']['Update']

export type Payment = Database['public']['Tables']['payments']['Row']
export type PaymentMethod = 'cash' | 'bank_transfer' | 'stripe'
export type PaymentKind   = 'deposit' | 'balance' | 'full' | 'other' | 'refund'

/** Net amount paid: sum of paid payments, with refunds subtracted. */
export function paidTotal(payments: Payment[]): number {
  return payments
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + (p.kind === 'refund' ? -Number(p.amount) : Number(p.amount)), 0)
}

// ─── Derived payment status (orthogonal to booking_status) ────────────────────

export type PaymentStatus =
  | 'unpriced' | 'unpaid' | 'deposit_paid' | 'part_paid' | 'paid' | 'refunded'

/** Fields needed to derive outstanding / payment status — a subset of a booking row. */
export type PayableBooking = {
  total_amount:  number | null
  amount_paid?:  number | null
  deposit_paid?: boolean | null
}

/** Exact outstanding balance using the persisted net amount_paid. */
export function outstandingOf(b: PayableBooking): number {
  if (b.total_amount == null) return 0
  return Math.max(0, b.total_amount - Number(b.amount_paid ?? 0))
}

/**
 * Payment progress for display. `hasRefund` distinguishes a refunded booking
 * that still shows a balance; omit it in list views where the ledger isn't loaded.
 */
export function paymentStatusOf(b: PayableBooking, hasRefund = false): PaymentStatus {
  if (b.total_amount == null) return 'unpriced'
  const paid = Number(b.amount_paid ?? 0)
  const outstanding = outstandingOf(b)
  if (hasRefund && outstanding > 0) return 'refunded'
  if (outstanding <= 0.001) return 'paid'
  if (paid <= 0.001) return 'unpaid'
  if (b.deposit_paid) return 'deposit_paid'
  return 'part_paid'
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

/**
 * Recompute and persist amount_paid / deposit_paid / balance_paid from the
 * ledger + the booking's current total. Authoritative and idempotent — sets
 * every flag both true AND false, so it stays correct when the total changes
 * (e.g. a charge is added after the balance was settled).
 */
export async function syncBookingPaymentFlags(bookingId: string): Promise<void> {
  const [{ data: booking }, { data: rows }] = await Promise.all([
    supabase.from('bookings').select('total_amount, deposit_paid_at, balance_paid_at').eq('id', bookingId).maybeSingle(),
    supabase.from('payments').select('amount, kind, status').eq('booking_id', bookingId).eq('status', 'paid'),
  ])
  const payments = (rows ?? []) as Pick<Payment, 'amount' | 'kind' | 'status'>[]
  const netPaid = paidTotal(payments as Payment[])
  const hasDeposit = payments.some(p => p.kind === 'deposit')
  const total = Number(booking?.total_amount ?? 0)
  const now = new Date().toISOString()

  const balancePaid = total > 0 && netPaid >= total - 0.001
  const depositPaid = hasDeposit || balancePaid

  const update: BookingUpdate = {
    amount_paid:     Math.round(netPaid * 100) / 100,
    deposit_paid:    depositPaid,
    deposit_paid_at: depositPaid ? (booking?.deposit_paid_at ?? now) : null,
    balance_paid:    balancePaid,
    balance_paid_at: balancePaid ? (booking?.balance_paid_at ?? now) : null,
  }
  await supabase.from('bookings').update(update).eq('id', bookingId)
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
