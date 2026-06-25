// =============================================================================
// send-feedback — sends a bug report or feature request to the PawBoard admin.
//
// Called from the app with the user's JWT. Reads business name + user email
// server-side so the client never needs to pass them.
//
// Deploy:  supabase functions deploy send-feedback
// Secrets: RESEND_API_KEY, EMAIL_FROM_ADDRESS
//          ADMIN_FEEDBACK_EMAIL (defaults to tomh@kudos-software.co.uk)
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { sendViaResend } from '../_shared/email.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = req.headers.get('Authorization') ?? ''
    const { type, message, pageUrl } = await req.json() as {
      type: 'bug' | 'feature'
      message: string
      pageUrl?: string
    }

    if (!type || !message?.trim()) return json({ error: 'type and message are required' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify the caller JWT and get their user record
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user }, error: userErr } = await caller.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    // Get business name via service role (the caller's RLS already confirmed they're a real user)
    const svc = createClient(supabaseUrl, serviceKey)
    const { data: staffRow } = await svc
      .from('staff_users')
      .select('first_name, last_name, businesses(name)')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const userName = staffRow
      ? `${staffRow.first_name} ${staffRow.last_name}`.trim()
      : user.email ?? 'Unknown user'
    const businessName = (staffRow?.businesses as { name: string } | null)?.name ?? 'Unknown business'

    const apiKey   = Deno.env.get('RESEND_API_KEY')
    const fromAddr = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'notifications@pawboard.app'
    const adminTo  = Deno.env.get('ADMIN_FEEDBACK_EMAIL') ?? 'tomh@kudos-software.co.uk'

    if (!apiKey) return json({ error: 'RESEND_API_KEY not set' }, 500)

    const typeLabel = type === 'bug' ? 'Bug Report' : 'Feature Request'
    const subject   = `[PawBoard ${typeLabel}] from ${businessName}`

    const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px">
  <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:16px">PawBoard — ${esc(typeLabel)}</div>
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:5px 0;color:#64748b;font-size:13px;width:120px">From</td><td style="padding:5px 0;color:#0f172a;font-size:13px;font-weight:600">${esc(userName)} (${esc(user.email ?? '')})</td></tr>
      <tr><td style="padding:5px 0;color:#64748b;font-size:13px">Business</td><td style="padding:5px 0;color:#0f172a;font-size:13px;font-weight:600">${esc(businessName)}</td></tr>
      <tr><td style="padding:5px 0;color:#64748b;font-size:13px">Type</td><td style="padding:5px 0;color:#0f172a;font-size:13px;font-weight:600">${esc(typeLabel)}</td></tr>
      ${pageUrl ? `<tr><td style="padding:5px 0;color:#64748b;font-size:13px">Page</td><td style="padding:5px 0;font-size:12px;color:#64748b;word-break:break-all">${esc(pageUrl)}</td></tr>` : ''}
    </table>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px">
      <p style="margin:0;font-size:14px;color:#0f172a;white-space:pre-wrap;line-height:1.6">${esc(message.trim())}</p>
    </div>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:12px;margin:16px 0 0">PawBoard — sent automatically from the app</p>
</div>
</body></html>`

    const result = await sendViaResend({
      apiKey,
      from: `PawBoard <${fromAddr}>`,
      replyTo: user.email,
      to: adminTo,
      subject,
      html,
    })

    if (result.error) return json({ error: result.error }, 500)
    return json({ ok: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
