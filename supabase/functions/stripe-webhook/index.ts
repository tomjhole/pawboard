// =============================================================================
// stripe-webhook — confirms Stripe Checkout payments
//
// Verifies the Stripe signature, marks the matching payment row paid, and
// updates the booking's deposit_paid / balance_paid flags.
//
// Deploy:   supabase functions deploy stripe-webhook --no-verify-jwt
//           (--no-verify-jwt because Stripe calls it without a Supabase JWT;
//            security comes from the Stripe signature check below.)
// Secret:   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
// Stripe:   Dashboard → Developers → Webhooks → add endpoint
//             https://<project-ref>.functions.supabase.co/stripe-webhook
//           event: checkout.session.completed
//           (use a TEST-mode endpoint while sandboxing; its signing secret is
//            the whsec_ value above)
// =============================================================================
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripeSecret =
  Deno.env.get('STRIPE_SECRET_KEY_TEST') ??
  Deno.env.get('STRIPE_SECRET_KEY_LIVE') ??
  Deno.env.get('STRIPE_SECRET_KEY') ?? ''

const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  const body = await req.text()
  const whSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, whSecret)
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${(e as Error).message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const sessionId     = session.id
    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : null
    const bookingId     = session.metadata?.booking_id
    const kind          = session.metadata?.kind

    await admin.from('payments').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntent,
    }).eq('stripe_checkout_session_id', sessionId)

    if (bookingId) {
      const { data: booking } = await admin.from('bookings').select('total_amount').eq('id', bookingId).maybeSingle()
      const { data: paidRows } = await admin.from('payments').select('amount').eq('booking_id', bookingId).eq('status', 'paid')
      const paid  = (paidRows ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0)
      const total = Number(booking?.total_amount ?? 0)

      const update: Record<string, unknown> = {}
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
        await admin.from('bookings').update(update).eq('id', bookingId)
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
