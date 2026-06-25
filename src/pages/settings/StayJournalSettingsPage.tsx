import { useState, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { usePlan } from '@/lib/plans'
import { PageHeader, Card, PlanGate } from '@/components/ui'

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

export default function StayJournalSettingsPage() {
  const { business, settings, reload } = useBusinessContext()
  const { can } = usePlan()
  const premium = can('stayJournal')
  const [enabled, setEnabled] = useState(true)
  const [visible, setVisible] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    setEnabled(settings?.stay_journal_enabled ?? true)
    setVisible(settings?.stay_journal_owner_visible ?? false)
  }, [settings])

  async function patch(next: { enabled?: boolean; visible?: boolean }) {
    if (!business) return
    const e = next.enabled ?? enabled
    const v = next.visible ?? visible
    setEnabled(e); setVisible(v)
    setSaveState('saving')
    await supabase.from('business_settings').upsert({
      business_id: business.id,
      stay_journal_enabled: e,
      stay_journal_owner_visible: v,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id' })
    setSaveState('saved')
    reload()
    setTimeout(() => setSaveState('idle'), 2000)
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Stay journal" description="Photo and update log kept during each stay" backHref="/settings" />

      {!premium && <PlanGate feature="Stay journal" requiredPlan="PawBoard Premium" className="mb-4" />}

      <Card padding="none">
        <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-slate-100">
          <BookOpen className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Stay journal</h2>
        </div>
        <div className="divide-y divide-slate-100">
          <Row title="Enable stay journal"
            description="Let staff log photos, meals, medication, walks and wellbeing updates against a booking.">
            <Toggle checked={enabled} disabled={!premium} onChange={v => patch({ enabled: v })} />
          </Row>
          <Row title="Show updates to owners"
            description="Owners with a portal account can view their pets' journal in the portal.">
            <Toggle checked={visible} disabled={!premium || !enabled} onChange={v => patch({ visible: v })} />
          </Row>
        </div>
      </Card>

      <div className="mt-3 h-5">
        {saveState !== 'idle' && (
          <span className={['text-xs', saveState === 'saved' ? 'text-emerald-600' : 'text-slate-400'].join(' ')}>
            {saveState === 'saving' ? 'Saving…' : 'Saved ✓'}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-2">
        Owner viewing also needs the owner portal enabled (Settings → Owner portal).
      </p>
    </div>
  )
}
