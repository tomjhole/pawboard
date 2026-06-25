import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Banknote, Landmark, CreditCard, Trash2, CheckCircle, XCircle, Plus, Mail,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { usePlan } from '@/lib/plans'
import { Button, Input, Textarea, Modal } from '@/components/ui'
import { fmtMoney } from '@/lib/reports'
import { notify } from '@/lib/notify'
import {
  paidTotal, depositAmount, syncBookingPaymentFlags, startCardCheckout,
  type Payment, type PaymentMethod, type PaymentKind,
} from '@/lib/payments'

const METHOD_ICON = {
  cash:          Banknote,
  bank_transfer: Landmark,
  stripe:        CreditCard,
} as const

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank transfer', stripe: 'Card',
}

const STATUS_PILL: Record<string, string> = {
  paid:      'bg-emerald-50 text-emerald-700',
  pending:   'bg-amber-50 text-amber-700',
  failed:    'bg-rose-50 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-500',
  refunded:  'bg-slate-100 text-slate-500',
}

export default function BookingPayments({ bookingId }: { bookingId: string }) {
  const { settings, business } = useBusinessContext()
  const { can } = usePlan()
  const currency = settings?.currency ?? 'GBP'

  const [payments, setPayments] = useState<Payment[]>([])
  const [total,    setTotal]    = useState<number | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [record,   setRecord]   = useState<PaymentMethod | null>(null)
  const [banner,   setBanner]   = useState<'success' | 'cancelled' | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [cardBusy,  setCardBusy]  = useState(false)
  const [emailBusy, setEmailBusy] = useState<'invoice' | 'receipt' | null>(null)
  const [emailMsg,  setEmailMsg]  = useState<string | null>(null)

  const [params, setParams] = useSearchParams()

  const load = useCallback(async () => {
    const [pRes, bRes] = await Promise.all([
      supabase.from('payments').select('*').eq('booking_id', bookingId).order('created_at', { ascending: false }),
      supabase.from('bookings').select('total_amount').eq('id', bookingId).maybeSingle(),
    ])
    setPayments((pRes.data ?? []) as Payment[])
    setTotal(bRes.data?.total_amount ?? null)
    setLoading(false)
  }, [bookingId])

  useEffect(() => { load() }, [load])

  // Return from Stripe Checkout
  useEffect(() => {
    const p = params.get('payment')
    if (p === 'success' || p === 'cancelled') {
      setBanner(p)
      const next = new URLSearchParams(params)
      next.delete('payment')
      setParams(next, { replace: true })
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (settings && settings.payments_enabled === false) return null

  const paid        = paidTotal(payments)
  const outstanding = total != null ? Math.max(0, total - paid) : null
  const hasPaidDeposit = payments.some(p => p.kind === 'deposit' && p.status === 'paid')

  const stripeOn  = !!settings?.stripe_enabled
  const canCard   = can('stripePayments')
  const showCard  = stripeOn && canCard && (outstanding ?? 0) > 0

  async function card(kind: 'deposit' | 'balance' | 'full') {
    setCardBusy(true); setCardError(null)
    const { error } = await startCardCheckout(bookingId, kind)
    if (error) { setCardError(error); setCardBusy(false) }
    // on success the browser redirects away
  }

  async function deletePayment(id: string) {
    await supabase.from('payments').delete().eq('id', id)
    await load()
  }

  async function emailDoc(kind: 'invoice' | 'receipt') {
    if (!business) return
    setEmailBusy(kind); setEmailMsg(null)
    const r = await notify(kind === 'invoice' ? 'invoice' : 'payment_receipt', {
      businessId: business.id, relatedId: bookingId, extra: { force: true },
    })
    setEmailBusy(null)
    setEmailMsg(r.sent
      ? (kind === 'invoice' ? 'Invoice emailed ✓' : 'Receipt emailed ✓')
      : (r.reason ?? 'Could not send the email.'))
  }

  return (
    <div className="mt-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
        </div>

        {banner && (
          <div className={[
            'flex items-center gap-2 px-5 py-2.5 text-sm border-b',
            banner === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-amber-50 text-amber-800 border-amber-100',
          ].join(' ')}>
            {banner === 'success'
              ? <><CheckCircle className="w-4 h-4" /> Card payment received. If it doesn't show below yet, give it a moment and refresh.</>
              : <><XCircle className="w-4 h-4" /> Card payment was cancelled.</>}
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
          <Tot label="Total" value={total != null ? fmtMoney(total, currency) : '—'} />
          <Tot label="Paid" value={fmtMoney(paid, currency)} tone={paid > 0 ? 'text-emerald-600' : undefined} />
          <Tot label="Outstanding"
            value={outstanding != null ? fmtMoney(outstanding, currency) : '—'}
            tone={outstanding && outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'} />
        </div>

        {/* Ledger */}
        {loading ? (
          <p className="px-5 py-4 text-sm text-slate-400">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400 italic">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {payments.map(p => {
              const Icon = METHOD_ICON[p.method as keyof typeof METHOD_ICON] ?? Banknote
              return (
                <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900">
                      {fmtMoney(Number(p.amount), currency)}
                      <span className="text-slate-400 font-normal"> · {METHOD_LABEL[p.method] ?? p.method}</span>
                      {p.kind !== 'other' && <span className="text-slate-400 font-normal capitalize"> · {p.kind}</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(p.paid_at ?? p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {p.notes && <> · {p.notes}</>}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_PILL[p.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {p.status}
                  </span>
                  {p.method !== 'stripe' && (
                    <button onClick={() => deletePayment(p.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 transition-colors" title="Remove">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* Actions */}
        <div className="px-5 py-3 border-t border-slate-100 space-y-2">
          {cardError && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{cardError}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Banknote className="w-3.5 h-3.5" />} onClick={() => setRecord('cash')}>
              Record cash
            </Button>
            <Button size="sm" variant="secondary" icon={<Landmark className="w-3.5 h-3.5" />} onClick={() => setRecord('bank_transfer')}>
              Record bank transfer
            </Button>

            {showCard && (paid === 0 ? (
              <>
                {!hasPaidDeposit && (
                  <Button size="sm" icon={<CreditCard className="w-3.5 h-3.5" />} loading={cardBusy} onClick={() => card('deposit')}>
                    Take deposit (card)
                  </Button>
                )}
                <Button size="sm" icon={<CreditCard className="w-3.5 h-3.5" />} loading={cardBusy} onClick={() => card('full')}>
                  Take full payment (card)
                </Button>
              </>
            ) : (
              <Button size="sm" icon={<CreditCard className="w-3.5 h-3.5" />} loading={cardBusy} onClick={() => card('balance')}>
                Take balance (card)
              </Button>
            ))}
          </div>

          {/* Email invoice / receipt (owner needs an email on file) */}
          {(total != null && (paid > 0 || (outstanding ?? 0) > 0)) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {outstanding != null && outstanding > 0 && (
                <Button size="sm" variant="ghost" icon={<Mail className="w-3.5 h-3.5" />}
                  loading={emailBusy === 'invoice'} onClick={() => emailDoc('invoice')}>
                  Email invoice
                </Button>
              )}
              {paid > 0 && (
                <Button size="sm" variant="ghost" icon={<Mail className="w-3.5 h-3.5" />}
                  loading={emailBusy === 'receipt'} onClick={() => emailDoc('receipt')}>
                  Email receipt
                </Button>
              )}
              {emailMsg && <span className="text-xs text-slate-500">{emailMsg}</span>}
            </div>
          )}

          {stripeOn && !canCard && (
            <p className="text-xs text-slate-400">Online card payments are available on the Premium plan.</p>
          )}
          {!stripeOn && (
            <p className="text-xs text-slate-400">
              Want to take card payments?{' '}
              <Link to="/settings/payments" className="underline hover:text-slate-600">Set up Stripe</Link>.
            </p>
          )}
        </div>
      </div>

      {record && (
        <RecordPaymentModal
          method={record}
          bookingId={bookingId}
          businessId={business?.id ?? ''}
          currency={currency}
          bankDetails={settings?.bank_transfer_details ?? null}
          defaultAmount={outstanding ?? 0}
          suggestDeposit={paid === 0 && total != null ? depositAmount(total, settings?.deposit_type ?? 'percentage', Number(settings?.deposit_value ?? 20)) : null}
          onClose={() => setRecord(null)}
          onSaved={() => { setRecord(null); load() }}
        />
      )}
    </div>
  )
}

function Tot({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${tone ?? 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

// ─── Record manual payment ───────────────────────────────────────────────────

function RecordPaymentModal({ method, bookingId, businessId, currency, defaultAmount, suggestDeposit, bankDetails, onClose, onSaved }: {
  method: PaymentMethod
  bookingId: string
  businessId: string
  currency: string
  defaultAmount: number
  suggestDeposit: number | null
  bankDetails: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(defaultAmount > 0 ? String(defaultAmount) : '')
  const [kind,   setKind]   = useState<PaymentKind>(suggestDeposit && Number(amount) === suggestDeposit ? 'deposit' : 'full')
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('Enter an amount greater than zero.'); return }
    setSaving(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: inserted, error } = await supabase.from('payments').insert({
      booking_id:  bookingId,
      business_id: businessId,
      amount:      amt,
      method,
      kind,
      status:      'paid',
      paid_at:     new Date().toISOString(),
      notes:       notes.trim() || null,
      created_by:  user?.id ?? null,
    }).select('id').single()
    if (error) { setError(error.message); setSaving(false); return }
    await syncBookingPaymentFlags(bookingId, kind)
    // Auto-send a receipt (honours the business's notify_payment_receipt toggle)
    notify('payment_receipt', { businessId, relatedId: bookingId, extra: { payment_id: inserted?.id } })
    setSaving(false)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} size="sm"
      title={method === 'cash' ? 'Record cash payment' : 'Record bank transfer'}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button form="rec-pay" type="submit" loading={saving} icon={<Plus className="w-4 h-4" />}>Record payment</Button>
      </>}
    >
      <form id="rec-pay" onSubmit={save} className="space-y-3" noValidate>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
        {method === 'bank_transfer' && bankDetails && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Bank details</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{bankDetails}</p>
          </div>
        )}
        <Input id="rp-amount" label={`Amount (${currency})`} type="number" min="0" step="0.01" required
          value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        {suggestDeposit != null && suggestDeposit > 0 && (
          <button type="button" onClick={() => { setAmount(String(suggestDeposit)); setKind('deposit') }}
            className="text-xs font-medium underline" style={{ color: 'var(--brand-primary)' }}>
            Use deposit amount ({fmtMoney(suggestDeposit, currency)})
          </button>
        )}
        <div className="space-y-1.5">
          <label htmlFor="rp-kind" className="block text-sm font-medium text-slate-700">This payment is a…</label>
          <select id="rp-kind" value={kind} onChange={e => setKind(e.target.value as PaymentKind)}
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-primary)]">
            <option value="deposit">Deposit</option>
            <option value="balance">Balance</option>
            <option value="full">Full payment</option>
            <option value="other">Other</option>
          </select>
        </div>
        <Textarea id="rp-notes" label="Notes (optional)" rows={2}
          value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reference, who paid, etc." />
      </form>
    </Modal>
  )
}
