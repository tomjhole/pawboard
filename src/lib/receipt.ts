import { supabase } from '@/lib/supabase'
import { fmtMoney } from '@/lib/reports'

type LineItem = { description: string; quantity: number; unit_price: number; total_price: number }
type Payment  = { amount: number; method: string; kind: string; paid_at: string | null; created_at: string }

function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', bank_transfer: 'Bank transfer', stripe: 'Card' }

/** Opens a print-friendly receipt for a booking in a new window and triggers print. */
export async function printBookingReceipt(bookingId: string, businessName: string, currency = 'GBP'): Promise<void> {
  const [{ data: booking }, { data: itemsData }, { data: paysData }] = await Promise.all([
    supabase.from('bookings')
      .select('id, start_date, end_date, total_amount, owner:owner_id ( first_name, last_name, email, address_line1, city, postcode )')
      .eq('id', bookingId).maybeSingle(),
    supabase.from('booking_line_items').select('description, quantity, unit_price, total_price').eq('booking_id', bookingId).order('sort_order'),
    supabase.from('payments').select('amount, method, kind, paid_at, created_at').eq('booking_id', bookingId).eq('status', 'paid').order('created_at'),
  ])
  if (!booking) { alert('Could not load the booking.'); return }

  const items = (itemsData ?? []) as LineItem[]
  const pays  = (paysData ?? []) as Payment[]
  const owner = (booking as { owner?: { first_name: string; last_name: string; email: string | null; address_line1: string | null; city: string | null; postcode: string | null } | null }).owner

  const ref     = `#${bookingId.slice(0, 8).toUpperCase()}`
  const total   = items.reduce((s, i) => s + Number(i.total_price), 0) || Number(booking.total_amount ?? 0)
  const paid    = pays.reduce((s, p) => s + Number(p.amount), 0)
  const balance = Math.max(0, total - paid)
  const fmtD = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const ownerLines = owner
    ? [`${owner.first_name} ${owner.last_name}`, owner.address_line1, [owner.city, owner.postcode].filter(Boolean).join(' '), owner.email]
        .filter(Boolean).map(l => esc(String(l))).join('<br>')
    : ''

  const itemRows = items.length
    ? items.map(i => `<tr><td>${esc(i.description)}</td><td class="r">${i.quantity}</td><td class="r">${fmtMoney(Number(i.unit_price), currency)}</td><td class="r">${fmtMoney(Number(i.total_price), currency)}</td></tr>`).join('')
    : `<tr><td colspan="4" class="muted">No itemised charges recorded.</td></tr>`

  const payRows = pays.length
    ? pays.map(p => `<tr><td>${fmtD((p.paid_at ?? p.created_at).slice(0, 10))}</td><td>${METHOD_LABEL[p.method] ?? p.method}${p.kind !== 'other' ? ` · ${p.kind}` : ''}</td><td class="r">${fmtMoney(Number(p.amount), currency)}</td></tr>`).join('')
    : `<tr><td colspan="3" class="muted">No payments recorded.</td></tr>`

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${ref}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0;padding:32px;max-width:640px}
  h1{font-size:20px;margin:0 0 2px} .sub{color:#64748b;font-size:13px;margin:0 0 24px}
  .row{display:flex;justify-content:space-between;gap:24px;margin-bottom:24px}
  .box h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px}
  .box div{font-size:13px;line-height:1.5}
  table{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:13px}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;border-bottom:1px solid #e2e8f0;padding:6px 8px}
  td{padding:7px 8px;border-bottom:1px solid #f1f5f9}
  .r{text-align:right} .muted{color:#94a3b8;font-style:italic}
  .totals{margin-left:auto;width:240px;font-size:14px}
  .totals .line{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{font-weight:700;border-top:2px solid #e2e8f0;margin-top:4px;padding-top:8px}
  .bal{color:#b45309;font-weight:700}
  @media print{body{padding:0}}
</style></head><body>
  <h1>${esc(businessName)}</h1>
  <p class="sub">Receipt ${ref}</p>
  <div class="row">
    <div class="box"><h3>Billed to</h3><div>${ownerLines || '—'}</div></div>
    <div class="box"><h3>Stay</h3><div>${fmtD(booking.start_date)} → ${fmtD(booking.end_date)}</div></div>
  </div>
  <table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div class="totals">
    <div class="line"><span>Total</span><span>${fmtMoney(total, currency)}</span></div>
    <div class="line"><span>Paid</span><span>${fmtMoney(paid, currency)}</span></div>
    <div class="line grand ${balance > 0 ? 'bal' : ''}"><span>${balance > 0 ? 'Balance due' : 'Paid in full'}</span><span>${fmtMoney(balance, currency)}</span></div>
  </div>
  <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:24px 0 4px">Payments</h3>
  <table><tbody>${payRows}</tbody></table>
  <p class="sub" style="margin-top:24px">Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
</body></html>`

  const w = window.open('', '_blank', 'width=720,height=900')
  if (!w) { alert('Allow pop-ups for this site to print the receipt.'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 250)
}
