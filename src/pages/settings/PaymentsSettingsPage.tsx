import { useState, useEffect } from 'react'
import { CreditCard, Banknote, FlaskConical } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { usePlan } from '@/lib/plans'
import { PageHeader, Card, Input, Textarea, PlanGate } from '@/components/ui'

type Fields = {
  payments_enabled: boolean
  require_balance_before_checkout: boolean
  stripe_enabled: boolean
  stripe_test_mode: boolean
  deposit_type: 'percentage' | 'fixed'
  deposit_value: string
  bank_transfer_details: string
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={['relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'].join(' ')}
      style={{ backgroundColor: checked && !disabled ? 'var(--brand-primary)' : '#cbd5e1' }}>
      <span className={['inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
    </button>
  )
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

export default function PaymentsSettingsPage() {
  const { business, settings, reload } = useBusinessContext()
  const { can } = usePlan()
  const canCard = can('stripePayments')
  const currency = settings?.currency ?? 'GBP'

  const [f, setF] = useState<Fields | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    setF({
      payments_enabled:                settings?.payments_enabled ?? true,
      require_balance_before_checkout: settings?.require_balance_before_checkout ?? false,
      stripe_enabled:                  settings?.stripe_enabled ?? false,
      stripe_test_mode:                settings?.stripe_test_mode ?? true,
      deposit_type:                    (settings?.deposit_type as 'percentage' | 'fixed') ?? 'percentage',
      deposit_value:                   String(settings?.deposit_value ?? 20),
      bank_transfer_details:           settings?.bank_transfer_details ?? '',
    })
  }, [settings])

  async function patch(updates: Partial<Omit<Fields, 'deposit_value'>> & { deposit_value?: number }) {
    if (!business || !f) return
    const next = { ...f, ...updates, deposit_value: updates.deposit_value != null ? String(updates.deposit_value) : f.deposit_value }
    setF(next)
    setSaveState('saving')
    await supabase.from('business_settings').upsert({
      business_id: business.id,
      payments_enabled:                next.payments_enabled,
      require_balance_before_checkout: next.require_balance_before_checkout,
      stripe_enabled:                  next.stripe_enabled,
      stripe_test_mode:                next.stripe_test_mode,
      deposit_type:                    next.deposit_type,
      deposit_value:                   parseFloat(next.deposit_value) || 0,
      bank_transfer_details:           next.bank_transfer_details.trim() || null,
      updated_at:                      new Date().toISOString(),
    }, { onConflict: 'business_id' })
    setSaveState('saved')
    reload()
    setTimeout(() => setSaveState('idle'), 2000)
  }

  if (!f) return null

  return (
    <div className="max-w-2xl">
      <PageHeader title="Payments" description="Deposits, manual payments and card payments" backHref="/settings" />

      <div className="space-y-5">
        {/* Manual payments */}
        <Card padding="none">
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-slate-100">
            <Banknote className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Payment tracking</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <Row title="Record payments on bookings" description="Track cash, bank transfer and card payments against each booking.">
              <Toggle checked={f.payments_enabled} onChange={v => patch({ payments_enabled: v })} />
            </Row>
            <div className="px-5 py-4">
              <Textarea id="bank-details" label="Bank transfer details (optional)" rows={3}
                value={f.bank_transfer_details}
                onChange={e => setF({ ...f, bank_transfer_details: e.target.value })}
                onBlur={() => patch({})}
                placeholder={'Account name\nSort code\nAccount number'} />
              <p className="text-xs text-slate-400 mt-1">Shown to staff when recording a bank transfer.</p>
            </div>
          </div>
        </Card>

        {/* Deposit */}
        <Card padding="none">
          <div className="px-5 pt-4 pb-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Deposit</h2>
            <p className="text-xs text-slate-500 mt-0.5">The suggested deposit when taking a payment.</p>
          </div>
          <div className="px-5 py-4 flex flex-wrap items-end gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 p-1">
              {(['percentage', 'fixed'] as const).map(t => (
                <button key={t} onClick={() => patch({ deposit_type: t })}
                  className={['px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    f.deposit_type === t ? 'text-white' : 'text-slate-500 hover:text-slate-700'].join(' ')}
                  style={f.deposit_type === t ? { backgroundColor: 'var(--brand-primary)' } : {}}>
                  {t === 'percentage' ? 'Percentage' : 'Fixed amount'}
                </button>
              ))}
            </div>
            <div className="w-32">
              <Input id="deposit-value"
                label={f.deposit_type === 'percentage' ? 'Percent (%)' : `Amount (${currency})`}
                type="number" min="0" step={f.deposit_type === 'percentage' ? '1' : '0.01'}
                value={f.deposit_value}
                onChange={e => setF({ ...f, deposit_value: e.target.value })}
                onBlur={() => patch({})} />
            </div>
          </div>
        </Card>

        {/* Balance before pickup */}
        <Card padding="none">
          <Row
            title="Require balance before pickup"
            description="Show a warning at check-out if there's still money owed (staff can override)."
          >
            <Toggle checked={f.require_balance_before_checkout} onChange={v => patch({ require_balance_before_checkout: v })} />
          </Row>
        </Card>

        {/* Card payments (Stripe) */}
        <Card padding="none">
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-slate-100">
            <CreditCard className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Card payments (Stripe)</h2>
          </div>

          {!canCard ? (
            <div className="p-5">
              <PlanGate feature="Online card payments" requiredPlan="PawBoard Premium" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <Row title="Enable card payments" description="Take deposits, balances or full payment by card via Stripe Checkout.">
                <Toggle checked={f.stripe_enabled} onChange={v => patch({ stripe_enabled: v })} />
              </Row>
              <Row title="Sandbox (test mode)" description="Use Stripe test keys and test cards. Turn off only when you're ready to take real payments.">
                <div className="flex items-center gap-2">
                  {f.stripe_test_mode && <FlaskConical className="w-3.5 h-3.5 text-amber-500" />}
                  <Toggle checked={f.stripe_test_mode} disabled={!f.stripe_enabled} onChange={v => patch({ stripe_test_mode: v })} />
                </div>
              </Row>
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Setup (one-time, technical)</p>
                <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
                  <li>Add your Stripe secret key as a Supabase secret (<span className="font-mono">STRIPE_SECRET_KEY_TEST</span>).</li>
                  <li>Deploy the <span className="font-mono">create-payment-checkout</span> and <span className="font-mono">stripe-webhook</span> functions.</li>
                  <li>Add the webhook endpoint in Stripe and set <span className="font-mono">STRIPE_WEBHOOK_SECRET</span>.</li>
                </ol>
                <p className="text-xs text-slate-400 mt-1.5">Full steps in <span className="font-mono">supabase/functions/README.md</span>. Test card: 4242 4242 4242 4242.</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-3 h-5">
        {saveState !== 'idle' && (
          <span className={['text-xs', saveState === 'saved' ? 'text-emerald-600' : 'text-slate-400'].join(' ')}>
            {saveState === 'saving' ? 'Saving…' : 'Saved ✓'}
          </span>
        )}
      </div>
    </div>
  )
}
