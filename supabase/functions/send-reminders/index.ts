// =============================================================================
// send-reminders — daily scheduled job. Sends arrival + vaccination-expiry
// reminders for Premium businesses that have them enabled. De-dupes via
// email_log so re-running never double-sends.
//
// Deploy:  supabase functions deploy send-reminders --no-verify-jwt
// Schedule (Supabase Cron, pg_cron + pg_net — run once a day), e.g.:
//   select cron.schedule('pawboard-reminders','0 8 * * *', $$
//     select net.http_post(
//       url := 'https://<project-ref>.functions.supabase.co/send-reminders',
//       headers := jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>'));
//   $$);
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as E from '../_shared/email.ts'

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')!
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return json({ error: 'RESEND_API_KEY not configured' }, 500)
  const fromAddr = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'notifications@pawboard.app'
  const admin = createClient(url, svc)

  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const todayIso = iso(today)
  const plus = (n: number) => { const x = new Date(today); x.setDate(x.getDate() + n); return iso(x) }

  async function alreadySent(type: string, relatedId: string): Promise<boolean> {
    const { data } = await admin.from('email_log').select('id').eq('type', type).eq('related_id', relatedId).eq('status', 'sent').limit(1)
    return (data?.length ?? 0) > 0
  }

  const [{ data: businesses }, { data: settingsAll }, { data: themesAll }] = await Promise.all([
    admin.from('businesses').select('id, name, email, subscription_plan'),
    admin.from('business_settings').select('*'),
    admin.from('business_theme').select('business_id, primary_colour, logo_url'),
  ])
  const settingsMap = new Map((settingsAll ?? []).map((s: any) => [s.business_id, s]))
  const themeMap    = new Map((themesAll ?? []).map((t: any) => [t.business_id, t]))

  let sent = 0
  for (const biz of (businesses ?? []) as any[]) {
    if (biz.subscription_plan !== 'premium') continue
    const s = settingsMap.get(biz.id)
    if (!s || s.email_enabled === false) continue
    const brand: E.Brand = { name: biz.name, colour: themeMap.get(biz.id)?.primary_colour ?? '#059669', logoUrl: themeMap.get(biz.id)?.logo_url ?? null }
    const from = `${biz.name} <${fromAddr}>`
    const replyTo = biz.email ?? null

    // ── Arrival reminders ──────────────────────────────────────────────────
    if (s.notify_arrival_reminder !== false) {
      const target = plus(Number(s.reminder_days_before ?? 2))
      const { data: bookings } = await admin.from('bookings')
        .select('id, start_date, end_date, owner:owner_id ( first_name, email ), booking_pets ( pet:pet_id ( name ) )')
        .eq('business_id', biz.id).eq('start_date', target)
        .in('status', ['confirmed', 'ready', 'details_outstanding'])
      for (const b of (bookings ?? []) as any[]) {
        const email = b.owner?.email
        if (!email || await alreadySent('arrival_reminder', b.id)) continue
        const pets = (b.booking_pets ?? []).map((bp: any) => bp.pet?.name).filter(Boolean).join(', ')
        const built = E.tplArrivalReminder(brand, { ownerName: b.owner.first_name, pets, start: b.start_date, end: b.end_date, days: Number(s.reminder_days_before ?? 2) })
        const r = await E.sendViaResend({ apiKey, from, replyTo, to: email, subject: built.subject, html: built.html })
        await admin.from('email_log').insert({ business_id: biz.id, to_email: email, type: 'arrival_reminder', subject: built.subject, related_type: 'booking', related_id: b.id, status: r.error ? 'failed' : 'sent', provider_id: r.id ?? null, error: r.error ?? null, sent_at: r.error ? null : new Date().toISOString() })
        if (!r.error) sent++
      }
    }

    // ── Vaccination-expiry reminders ───────────────────────────────────────
    if (s.notify_vaccination_reminder !== false) {
      const window = plus(Number(s.vaccination_reminder_days ?? 21))
      const { data: upcoming } = await admin.from('bookings')
        .select('booking_pets ( pet_id )')
        .eq('business_id', biz.id).gte('end_date', todayIso).neq('status', 'cancelled')
      const petIds = [...new Set(((upcoming ?? []) as any[]).flatMap(b => (b.booking_pets ?? []).map((bp: any) => bp.pet_id)))]
      if (petIds.length > 0) {
        const { data: vax } = await admin.from('vaccinations')
          .select('id, vaccination_type, expiry_date, pet:pet_id ( name, owner:owner_id ( first_name, email ) )')
          .in('pet_id', petIds).eq('is_verified', true)
          .gte('expiry_date', todayIso).lte('expiry_date', window)
        for (const v of (vax ?? []) as any[]) {
          const owner = v.pet?.owner
          if (!owner?.email || await alreadySent('vaccination_reminder', v.id)) continue
          const built = E.tplVaccinationReminder(brand, { ownerName: owner.first_name, petName: v.pet.name, vaxType: v.vaccination_type, expiry: v.expiry_date })
          const r = await E.sendViaResend({ apiKey, from, replyTo, to: owner.email, subject: built.subject, html: built.html })
          await admin.from('email_log').insert({ business_id: biz.id, to_email: owner.email, type: 'vaccination_reminder', subject: built.subject, related_type: 'vaccination', related_id: v.id, status: r.error ? 'failed' : 'sent', provider_id: r.id ?? null, error: r.error ?? null, sent_at: r.error ? null : new Date().toISOString() })
          if (!r.error) sent++
        }
      }
    }
  }

  return json({ ok: true, sent })
})
