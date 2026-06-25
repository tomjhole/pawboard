// =============================================================================
// create-payment-checkout — Stripe Checkout Session for a booking payment
//
// Called by staff from the booking page. Computes the amount for a deposit /
// balance / full payment, creates a Stripe Checkout Session, records a PENDING
// payment row, and returns the redirect URL. The webhook marks it paid.
//
// Deploy:   supabase functions deploy create-payment-checkout
// Secrets:  supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
//                                STRIPE_SECRET_KEY_LIVE=sk_live_...   (optional until going live)
//           (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided automatically)
// Sandbox:  picks the TEST key when the business has stripe_test_mode = true.
// =============================================================================
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type Kind = 'deposit' | 'balance' | 'full'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const { booking_id, kind, origin } = await req.json() as { booking_id: string; kind: Kind; origin?: string }

    if (!booking_id || !['deposit', 'balance', 'full'].includes(kind)) {
      return json({ error: 'Invalid request' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Caller-scoped client — RLS ensures the user can only see their own business's booking.
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const { data: booking } = await userClient
      .from('bookings')
      .select('id, business_id, total_amount')
      .eq('id', booking_id)
      .maybeSingle()
    if (!booking) return json({ error: 'Booking not found' }, 404)
    if (booking.total_amount == null) return json({ error: 'Set a total on the booking before taking payment.' }, 400)

    // Service client for config + ledger.
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: settings } = await admin
      .from('business_settings')
      .select('currency, stripe_enabled, stripe_test_mode, deposit_type, deposit_value')
      .eq('business_id', booking.business_id)
      .maybeSingle()
    if (!settings?.stripe_enabled) return json({ error: 'Card payments are not enabled for this business.' }, 400)

    const { data: paidRows } = await admin
      .from('payments').select('amount').eq('booking_id', booking_id).eq('status', 'paid')
    const paid        = (paidRows ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0)
    const total       = Number(booking.total_amount)
    const outstanding = Math.max(0, total - paid)

    let amount = outstanding
    if (kind === 'deposit') {
      const dep = settings.deposit_type === 'fixed'
        ? Number(settings.deposit_value)
        : Math.round(total * Number(settings.deposit_value)) / 100   // value = percent
      amount = Math.min(dep, outstanding)
    }
    amount = Math.round(amount * 100) / 100
    if (amount <= 0) return json({ error: 'There is nothing left to pay on this booking.' }, 400)

    const testMode = settings.stripe_test_mode !== false
    const secret = testMode
      ? (Deno.env.get('STRIPE_SECRET_KEY_TEST') ?? Deno.env.get('STRIPE_SECRET_KEY'))
      : (Deno.env.get('STRIPE_SECRET_KEY_LIVE') ?? Deno.env.get('STRIPE_SECRET_KEY'))
    if (!secret) return json({ error: 'Stripe secret key is not configured for this mode.' }, 500)

    const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })
    const currency = String(settings.currency ?? 'GBP').toLowerCase()
    const base = origin ?? Deno.env.get('APP_URL') ?? ''
    const label = kind === 'deposit' ? 'Deposit' : kind === 'full' ? 'Full payment' : 'Balance'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency,
          product_data: { name: `${label} — booking ${booking_id.slice(0, 8).toUpperCase()}` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      success_url: `${base}/bookings/${booking_id}?payment=success`,
      cancel_url:  `${base}/bookings/${booking_id}?payment=cancelled`,
      metadata: { booking_id, business_id: booking.business_id, kind },
    })

    await admin.from('payments').insert({
      business_id: booking.business_id,
      booking_id,
      amount,
      method: 'stripe',
      kind,
      status: 'pending',
      stripe_checkout_session_id: session.id,
      created_by: user.id,
    })

    return json({ url: session.url }, 200)
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500)
  }
})
