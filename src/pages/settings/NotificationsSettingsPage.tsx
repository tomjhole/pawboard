import { useState, useEffect } from 'react'
import { Mail, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { usePlan } from '@/lib/plans'
import { PageHeader, Card, Input, PlanGate } from '@/components/ui'

type Fields = {
  email_enabled: boolean
  send_booking_confirmation: boolean
  notify_booking_changes: boolean
  notify_cancellation: boolean
  notify_payment_receipt: boolean
  notify_booking_request: boolean
  notify_arrival_reminder: boolean
  notify_vaccination_reminder: boolean
  reminder_days_before: string
  vaccination_reminder_days: string
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

function Row({ title, description, checked, disabled, onChange }: {
  title: string; description: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className={['text-sm font-medium', disabled ? 'text-slate-400' : 'text-slate-900'].join(' ')}>{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}

export default function NotificationsSettingsPage() {
  const { business, settings, reload } = useBusinessContext()
  const { can } = usePlan()
  const canReminders = can('emailReminders')

  const [f, setF] = useState<Fields | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    setF({
      email_enabled:               settings?.email_enabled ?? true,
      send_booking_confirmation:   settings?.send_booking_confirmation ?? true,
      notify_booking_changes:      settings?.notify_booking_changes ?? true,
      notify_cancellation:         settings?.notify_cancellation ?? true,
      notify_payment_receipt:      settings?.notify_payment_receipt ?? true,
      notify_booking_request:      settings?.notify_booking_request ?? true,
      notify_arrival_reminder:     settings?.notify_arrival_reminder ?? true,
      notify_vaccination_reminder: settings?.notify_vaccination_reminder ?? true,
      reminder_days_before:        String(settings?.reminder_days_before ?? 2),
      vaccination_reminder_days:   String(settings?.vaccination_reminder_days ?? 21),
    })
  }, [settings])

  async function patch(updates: Partial<Omit<Fields, 'reminder_days_before' | 'vaccination_reminder_days'>> & {
    reminder_days_before?: number; vaccination_reminder_days?: number
  }) {
    if (!business || !f) return
    const next: Fields = {
      ...f, ...updates,
      reminder_days_before:      updates.reminder_days_before != null ? String(updates.reminder_days_before) : f.reminder_days_before,
      vaccination_reminder_days: updates.vaccination_reminder_days != null ? String(updates.vaccination_reminder_days) : f.vaccination_reminder_days,
    }
    setF(next)
    setSaveState('saving')
    await supabase.from('business_settings').upsert({
      business_id: business.id,
      email_enabled:               next.email_enabled,
      send_booking_confirmation:   next.send_booking_confirmation,
      notify_booking_changes:      next.notify_booking_changes,
      notify_cancellation:         next.notify_cancellation,
      notify_payment_receipt:      next.notify_payment_receipt,
      notify_booking_request:      next.notify_booking_request,
      notify_arrival_reminder:     next.notify_arrival_reminder,
      notify_vaccination_reminder: next.notify_vaccination_reminder,
      reminder_days_before:        parseInt(next.reminder_days_before) || 0,
      vaccination_reminder_days:   parseInt(next.vaccination_reminder_days) || 0,
      updated_at:                  new Date().toISOString(),
    }, { onConflict: 'business_id' })
    setSaveState('saved')
    reload()
    setTimeout(() => setSaveState('idle'), 2000)
  }

  if (!f) return null
  const off = !f.email_enabled

  return (
    <div className="max-w-2xl">
      <PageHeader title="Notifications" description="Choose which automatic emails go out to your customers" backHref="/settings" />

      <div className="space-y-5">
        {/* Master */}
        <Card padding="none">
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Send automatic emails</p>
                <p className="text-xs text-slate-500 mt-0.5">Master switch. With this off, none of the emails below are sent.</p>
              </div>
            </div>
            <Toggle checked={f.email_enabled} onChange={v => patch({ email_enabled: v })} />
          </div>
        </Card>

        {/* Owner emails */}
        <Card padding="none">
          <div className="px-5 pt-4 pb-2 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Owner emails</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <Row title="Booking confirmation" description="When you confirm a booking." disabled={off}
              checked={f.send_booking_confirmation} onChange={v => patch({ send_booking_confirmation: v })} />
            <Row title="Booking changed" description="When a confirmed booking's dates change." disabled={off}
              checked={f.notify_booking_changes} onChange={v => patch({ notify_booking_changes: v })} />
            <Row title="Cancellation" description="When a booking is cancelled." disabled={off}
              checked={f.notify_cancellation} onChange={v => patch({ notify_cancellation: v })} />
            <Row title="Payment receipt" description="When a payment is recorded or paid by card." disabled={off}
              checked={f.notify_payment_receipt} onChange={v => patch({ notify_payment_receipt: v })} />
            <Row title="Booking request received" description="Acknowledges an owner's request from the portal." disabled={off}
              checked={f.notify_booking_request} onChange={v => patch({ notify_booking_request: v })} />
          </div>
          <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
            Invoices, receipts and portal invites can also be emailed on demand from a booking or owner page — those always send when you click.
          </p>
        </Card>

        {/* Reminders (Premium) */}
        <Card padding="none">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2 border-b border-slate-100">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Reminders</h2>
          </div>
          {!canReminders ? (
            <div className="p-5"><PlanGate feature="Automatic reminders" requiredPlan="PawBoard Premium" /></div>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={['text-sm font-medium', off ? 'text-slate-400' : 'text-slate-900'].join(' ')}>Arrival reminder</p>
                    <p className="text-xs text-slate-500 mt-0.5">Remind owners before their pet's stay.</p>
                  </div>
                  <Toggle checked={f.notify_arrival_reminder} disabled={off} onChange={v => patch({ notify_arrival_reminder: v })} />
                </div>
                {f.notify_arrival_reminder && !off && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <div className="w-20"><Input id="rem-days" type="number" min="0" max="30" value={f.reminder_days_before}
                      onChange={e => setF({ ...f, reminder_days_before: e.target.value })}
                      onBlur={() => patch({ reminder_days_before: parseInt(f.reminder_days_before) || 0 })} /></div>
                    <span className="text-sm text-slate-500">days before arrival</span>
                  </div>
                )}
              </div>
              <div className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={['text-sm font-medium', off ? 'text-slate-400' : 'text-slate-900'].join(' ')}>Vaccination expiry</p>
                    <p className="text-xs text-slate-500 mt-0.5">Chase owners whose pet's vaccination is about to lapse before a stay.</p>
                  </div>
                  <Toggle checked={f.notify_vaccination_reminder} disabled={off} onChange={v => patch({ notify_vaccination_reminder: v })} />
                </div>
                {f.notify_vaccination_reminder && !off && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <div className="w-20"><Input id="vax-days" type="number" min="1" max="90" value={f.vaccination_reminder_days}
                      onChange={e => setF({ ...f, vaccination_reminder_days: e.target.value })}
                      onBlur={() => patch({ vaccination_reminder_days: parseInt(f.vaccination_reminder_days) || 0 })} /></div>
                    <span className="text-sm text-slate-500">days' notice</span>
                  </div>
                )}
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

      <p className="text-xs text-slate-400 mt-2">
        Emails send from your verified domain via Resend — see the setup notes in the Edge Function README.
      </p>
    </div>
  )
}
