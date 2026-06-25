// Shared email helpers: Resend sender + a branded HTML layout + per-type templates.
// Used by send-email and send-reminders.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export async function sendViaResend(p: {
  apiKey: string; from: string; replyTo?: string | null; to: string; subject: string; html: string
}): Promise<{ id?: string; error?: string }> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: p.from,
      reply_to: p.replyTo || undefined,
      to: [p.to],
      subject: p.subject,
      html: p.html,
    }),
  })
  if (!res.ok) return { error: `Resend ${res.status}: ${await res.text()}` }
  const j = await res.json().catch(() => ({}))
  return { id: j.id }
}

export function fmtMoney(n: number, currency = 'GBP'): string {
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n) }
  catch { return `£${n.toFixed(2)}` }
}

export function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

export type Brand = { name: string; colour: string; logoUrl?: string | null }

export function layout(brand: Brand, o: {
  heading: string
  intro?: string
  rows?: [string, string][]
  bodyHtml?: string
  ctaText?: string
  ctaUrl?: string
  note?: string
}): string {
  const colour = brand.colour || '#059669'
  const rows = (o.rows ?? []).map(([k, v]) =>
    `<tr><td style="padding:6px 0;color:#64748b;font-size:14px">${esc(k)}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;text-align:right;font-weight:600">${v}</td></tr>`).join('')
  const cta = o.ctaText && o.ctaUrl
    ? `<a href="${esc(o.ctaUrl)}" style="display:inline-block;background:${colour};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;margin-top:8px">${esc(o.ctaText)}</a>`
    : ''
  const header = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" style="max-height:40px">`
    : `<div style="font-size:18px;font-weight:700;color:#0f172a">${esc(brand.name)}</div>`
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="margin-bottom:16px">${header}</div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
      <h1 style="margin:0 0 10px;font-size:18px;color:#0f172a">${esc(o.heading)}</h1>
      ${o.intro ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569">${esc(o.intro)}</p>` : ''}
      ${rows ? `<table style="width:100%;border-collapse:collapse;margin:4px 0 16px">${rows}</table>` : ''}
      ${o.bodyHtml ?? ''}
      ${cta}
      ${o.note ? `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.5">${esc(o.note)}</p>` : ''}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin:16px 0 0">Sent by ${esc(brand.name)} · powered by PawBoard</p>
  </div></body></html>`
}

// ─── Per-type templates ───────────────────────────────────────────────────────
// Each takes a brand + plain data and returns { subject, html }.

type Built = { subject: string; html: string }

export function tplBookingConfirmation(b: Brand, d: { ownerName: string; pets: string; start: string; end: string; nights: number }): Built {
  return {
    subject: `Booking confirmed — ${b.name}`,
    html: layout(b, {
      heading: 'Your booking is confirmed 🐾',
      intro: `Hi ${d.ownerName}, we're all set for ${d.pets || 'your pet'}. Here are the details:`,
      rows: [['Arrival', fmtDate(d.start)], ['Collection', fmtDate(d.end)], ['Nights', String(d.nights)], ['Pets', d.pets || '—']],
      note: 'If anything looks wrong, just reply to this email.',
    }),
  }
}

export function tplBookingChanged(b: Brand, d: { ownerName: string; pets: string; start: string; end: string; nights: number }): Built {
  return {
    subject: `Booking updated — ${b.name}`,
    html: layout(b, {
      heading: 'Your booking dates have changed',
      intro: `Hi ${d.ownerName}, your booking for ${d.pets || 'your pet'} has been updated:`,
      rows: [['New arrival', fmtDate(d.start)], ['New collection', fmtDate(d.end)], ['Nights', String(d.nights)]],
      note: "If you didn't request this, please get in touch.",
    }),
  }
}

export function tplBookingCancelled(b: Brand, d: { ownerName: string; pets: string; start: string; end: string }): Built {
  return {
    subject: `Booking cancelled — ${b.name}`,
    html: layout(b, {
      heading: 'Your booking has been cancelled',
      intro: `Hi ${d.ownerName}, your booking for ${d.pets || 'your pet'} (${fmtDate(d.start)} – ${fmtDate(d.end)}) has been cancelled.`,
      note: 'If this was a mistake, reply and we’ll sort it out.',
    }),
  }
}

export function tplPaymentReceipt(b: Brand, d: {
  ownerName: string; currency: string; amount: number; method: string; total: number; paid: number; outstanding: number
}): Built {
  return {
    subject: `Payment received — ${b.name}`,
    html: layout(b, {
      heading: 'Thanks — payment received',
      intro: `Hi ${d.ownerName}, we've received your ${d.method} payment of ${fmtMoney(d.amount, d.currency)}.`,
      rows: [
        ['Booking total', fmtMoney(d.total, d.currency)],
        ['Paid to date', fmtMoney(d.paid, d.currency)],
        ['Balance', d.outstanding > 0 ? fmtMoney(d.outstanding, d.currency) : 'Paid in full'],
      ],
    }),
  }
}

export function tplInvoice(b: Brand, d: {
  ownerName: string; currency: string; total: number; paid: number; outstanding: number; start: string; end: string; bankDetails?: string | null
}): Built {
  return {
    subject: `Invoice — ${b.name}`,
    html: layout(b, {
      heading: d.outstanding > 0 ? `Balance due: ${fmtMoney(d.outstanding, d.currency)}` : 'Your invoice',
      intro: `Hi ${d.ownerName}, here's the invoice for your stay ${fmtDate(d.start)} – ${fmtDate(d.end)}.`,
      rows: [
        ['Total', fmtMoney(d.total, d.currency)],
        ['Paid', fmtMoney(d.paid, d.currency)],
        ['Balance due', fmtMoney(d.outstanding, d.currency)],
      ],
      bodyHtml: d.bankDetails
        ? `<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase">Pay by bank transfer</p><p style="margin:0 0 12px;font-size:14px;color:#0f172a;white-space:pre-wrap">${esc(d.bankDetails)}</p>`
        : '',
      note: 'Reply to this email with any questions about your invoice.',
    }),
  }
}

export function tplPortalInvite(b: Brand, d: { ownerName: string; link: string }): Built {
  return {
    subject: `Manage your pets online with ${b.name}`,
    html: layout(b, {
      heading: `You're invited to the ${b.name} owner portal`,
      intro: `Hi ${d.ownerName}, you can now view your pets, upload vaccination certificates and request stays online. Tap below to set a password and get started.`,
      ctaText: 'Set up my account',
      ctaUrl: d.link,
      note: "If you didn't expect this, you can ignore this email.",
    }),
  }
}

export function tplBookingRequestReceived(b: Brand, d: { ownerName: string; pets: string; start: string; end: string }): Built {
  return {
    subject: `We've got your request — ${b.name}`,
    html: layout(b, {
      heading: 'Thanks — we’ve received your request',
      intro: `Hi ${d.ownerName}, we've received your request for ${d.pets || 'your pet'} (${fmtDate(d.start)} – ${fmtDate(d.end)}). We'll confirm availability and be in touch shortly.`,
      note: 'This is a request, not a confirmed booking yet.',
    }),
  }
}

export function tplArrivalReminder(b: Brand, d: { ownerName: string; pets: string; start: string; end: string; days: number }): Built {
  return {
    subject: `Reminder: ${d.pets || 'your pet'}'s stay is coming up — ${b.name}`,
    html: layout(b, {
      heading: `See you in ${d.days} day${d.days === 1 ? '' : 's'}`,
      intro: `Hi ${d.ownerName}, a quick reminder that ${d.pets || 'your pet'} is booked in soon:`,
      rows: [['Arrival', fmtDate(d.start)], ['Collection', fmtDate(d.end)]],
      note: 'Please make sure vaccinations are up to date and bring any medication/food.',
    }),
  }
}

export function tplVaccinationReminder(b: Brand, d: { ownerName: string; petName: string; vaxType: string; expiry: string }): Built {
  return {
    subject: `${d.petName}'s vaccination needs renewing — ${b.name}`,
    html: layout(b, {
      heading: `${d.petName}'s ${d.vaxType} is expiring`,
      intro: `Hi ${d.ownerName}, ${d.petName}'s ${d.vaxType} expires on ${fmtDate(d.expiry)}. Please make sure it's renewed before the upcoming stay, and send us the updated certificate.`,
      note: 'Up-to-date vaccinations are required for boarding.',
    }),
  }
}
