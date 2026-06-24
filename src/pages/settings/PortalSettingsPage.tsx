import { useState, useEffect } from 'react'
import { Globe } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { PageHeader, Card } from '@/components/ui'

type PortalFields = {
  portal_enabled: boolean
  portal_allow_pet_edits: boolean
  portal_allow_documents: boolean
  portal_allow_booking_requests: boolean
}

function Toggle({ checked, disabled, onChange }: {
  checked: boolean; disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
      style={{ backgroundColor: checked && !disabled ? 'var(--brand-primary)' : '#cbd5e1' }}
    >
      <span className={[
        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5',
      ].join(' ')} />
    </button>
  )
}

function Row({ title, description, checked, disabled, onChange }: {
  title: string; description: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className={['text-sm font-medium', disabled ? 'text-slate-400' : 'text-slate-900'].join(' ')}>{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}

export default function PortalSettingsPage() {
  const { business, settings, reload } = useBusinessContext()
  const [fields, setFields] = useState<PortalFields | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    setFields({
      portal_enabled:                settings?.portal_enabled ?? false,
      portal_allow_pet_edits:        settings?.portal_allow_pet_edits ?? true,
      portal_allow_documents:        settings?.portal_allow_documents ?? true,
      portal_allow_booking_requests: settings?.portal_allow_booking_requests ?? true,
    })
  }, [settings])

  async function patch(updates: Partial<PortalFields>) {
    if (!business || !fields) return
    const next = { ...fields, ...updates }
    setFields(next)
    setSaveState('saving')
    await supabase.from('business_settings').upsert(
      { business_id: business.id, ...next, updated_at: new Date().toISOString() },
      { onConflict: 'business_id' },
    )
    setSaveState('saved')
    reload()
    setTimeout(() => setSaveState('idle'), 2000)
  }

  if (!fields) return null
  const master = fields.portal_enabled

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Owner portal"
        description="Let your customers manage their pets and request stays online"
        backHref="/settings"
      />

      <Card padding="none">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
              <Globe className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Enable owner portal</p>
              <p className="text-xs text-slate-500 mt-0.5">
                When on, invited owners can sign in at <span className="font-mono">/portal</span> to see their pets and bookings.
              </p>
            </div>
          </div>
          <Toggle checked={master} onChange={v => patch({ portal_enabled: v })} />
        </div>

        <div className="divide-y divide-slate-100">
          <Row
            title="Allow pet edits"
            description="Owners can update feeding, behaviour, medical, vet and insurance details for their pets."
            checked={fields.portal_allow_pet_edits}
            disabled={!master}
            onChange={v => patch({ portal_allow_pet_edits: v })}
          />
          <Row
            title="Allow document uploads"
            description="Owners can upload vaccination certificates and other documents for staff to review."
            checked={fields.portal_allow_documents}
            disabled={!master}
            onChange={v => patch({ portal_allow_documents: v })}
          />
          <Row
            title="Allow booking requests"
            description="Owners can request a stay. Requests arrive as enquiries for you to confirm."
            checked={fields.portal_allow_booking_requests}
            disabled={!master}
            onChange={v => patch({ portal_allow_booking_requests: v })}
          />
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
        Invite individual owners to the portal from their owner page.
      </p>
    </div>
  )
}
