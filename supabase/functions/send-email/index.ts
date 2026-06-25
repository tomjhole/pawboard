// =============================================================================
// send-email — renders & sends a branded transactional email via Resend.
//
// Called by the app (fire-and-forget) with the user's JWT. Decides the
// recipient + content server-side from `related_id`, honours the business's
// notification toggles, and logs every attempt to email_log.
//
// Deploy:  supabase functions deploy send-email
// Secrets: supabase secrets set RESEND_API_KEY=re_...
//          (optional) supabase secrets set EMAIL_FROM_ADDRESS=notifications@yourdomain
//          APP_URL is used as a fallback origin for links.
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as E from '../_shared/email.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Automatic types → the business_settings toggle that controls them.
const TOGGLE: Record<string, string> = {
  booking_confirmation:     'send_booking_confirmation',
  booking_changed:          'notify_booking_changes',
  booking_cancelled:        'notify_cancellation',
  payment_receipt:          'notify_payment_receipt',
  booking_request_received: 'notify_booking_request',
}

const methodLabel = (m?: string) =>
  m === 'cash' ? 'cash' : m === 'bank_transfer' ? 'bank transfer' : m === 'stripe' ? 'card' : 'manual'

const nightsBetween = (a: string, b: string) =>
  Math.max(0, Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const { type, business_id, related_id, extra, origin } = await req.json()
    if (!type || !business_id) return json({ error: 'Invalid request' }, 400)

    const url  = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const svc  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)
    const admin = createClient(url, svc)

    const [{ data: business }, { data: theme }, { data: settings }] = await Promise.all([
      admin.from('businesses').select('name, email').eq('id', business_id).maybeSingle(),
      admin.from('business_theme').select('primary_colour, logo_url').eq('business_id', business_id).maybeSingle(),
      admin.from('business_settings').select('*').eq('business_id', business_id).maybeSingle(),
    ])
    if (!business) return json({ error: 'Business not found' }, 404)

    // Gates
    const force = !!(extra && extra.force)
    if (settings && settings.email_enabled === false) return json({ sent: false, reason: 'Email notifications are turned off' })
    const toggleCol = TOGGLE[type]
    if (toggleCol && !force && settings && settings[toggleCol] === false) {
      return json({ sent: false, reason: 'This notification is turned off' })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) return json({ error: 'RESEND_API_KEY is not configured' }, 500)

    const brand: E.Brand = { name: business.name, colour: theme?.primary_colour ?? '#059669', logoUrl: theme?.logo_url ?? null }
    const fromAddr = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'notifications@pawboard.app'
    const from     = `${business.name} <${fromAddr}>`
    const replyTo  = business.email ?? null
    const base     = origin ?? Deno.env.get('APP_URL') ?? ''
    const currency = settings?.currency ?? 'GBP'

    let to = ''
    let relatedType = 'booking'
    let built: { subject: string; html: string } | null = null

    if (type === 'portal_invite') {
      relatedType = 'owner'
      const { data: allowed } = await userClient.from('owners').select('id').eq('id', related_id).maybeSingle()
      if (!allowed) return json({ error: 'Not allowed' }, 403)
      const { data: owner } = await admin.from('owners').select('first_name, email').eq('id', related_id).maybeSingle()
      if (!owner?.email) return json({ sent: false, reason: 'This owner has no email address' })
      to = owner.email
      built = E.tplPortalInvite(brand, { ownerName: owner.first_name, link: `${base}/portal/join?token=${extra?.token ?? ''}` })
    } else {
      // Booking-based types — RLS check that the caller can see this booking.
      const { data: allowed } = await userClient.from('bookings').select('id').eq('id', related_id).maybeSingle()
      if (!allowed) return json({ error: 'Not allowed' }, 403)
      const { data: booking } = await admin.from('bookings')
        .select('start_date, end_date, total_amount, owner:owner_id ( first_name, email ), booking_pets ( pet:pet_id ( name ) )')
        .eq('id', related_id).maybeSingle()
      if (!booking) return json({ error: 'Booking not found' }, 404)
      const owner = booking.owner as { first_name: string; email: string | null } | null
      if (!owner?.email) return json({ sent: false, reason: 'No email on file for this owner' })
      to = owner.email
      const ownerName = owner.first_name
      const pets = ((booking.booking_pets ?? []) as { pet: { name: string } | null }[]).map(bp => bp.pet?.name).filter(Boolean).join(', ')
      const nights = nightsBetween(booking.start_date, booking.end_date)

      if (type === 'booking_confirmation')     built = E.tplBookingConfirmation(brand, { ownerName, pets, start: booking.start_date, end: booking.end_date, nights })
      else if (type === 'booking_changed')     built = E.tplBookingChanged(brand, { ownerName, pets, start: booking.start_date, end: booking.end_date, nights })
      else if (type === 'booking_cancelled')   built = E.tplBookingCancelled(brand, { ownerName, pets, start: booking.start_date, end: booking.end_date })
      else if (type === 'booking_request_received') built = E.tplBookingRequestReceived(brand, { ownerName, pets, start: booking.start_date, end: booking.end_date })
      else if (type === 'payment_receipt' || type === 'invoice') {
        const { data: pays } = await admin.from('payments').select('amount, method, created_at').eq('booking_id', related_id).eq('status', 'paid').order('created_at')
        const list  = (pays ?? []) as { amount: number; method: string }[]
        const total = Number(booking.total_amount ?? 0)
        const paid  = list.reduce((s, p) => s + Number(p.amount), 0)
        const outstanding = Math.max(0, total - paid)
        if (type === 'payment_receipt') {
          const last = list[list.length - 1]
          built = E.tplPaymentReceipt(brand, { ownerName, currency, amount: Number(last?.amount ?? paid), method: methodLabel(last?.method), total, paid, outstanding })
        } else {
          built = E.tplInvoice(brand, { ownerName, currency, total, paid, outstanding, start: booking.start_date, end: booking.end_date, bankDetails: settings?.bank_transfer_details ?? null })
        }
      }
    }

    if (!built) return json({ error: 'Unknown email type' }, 400)

    const res = await E.sendViaResend({ apiKey, from, replyTo, to, subject: built.subject, html: built.html })
    await admin.from('email_log').insert({
      business_id, to_email: to, type, subject: built.subject, related_type: relatedType, related_id,
      status: res.error ? 'failed' : 'sent', provider_id: res.id ?? null, error: res.error ?? null,
      sent_at: res.error ? null : new Date().toISOString(),
    })
    return res.error ? json({ sent: false, reason: res.error }) : json({ sent: true })
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500)
  }
})
