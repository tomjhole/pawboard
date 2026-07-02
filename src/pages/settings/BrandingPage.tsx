import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, ImageIcon, Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { Button, PageHeader, Card, PlanGate } from '@/components/ui'
import { usePlan } from '@/lib/plans'

interface FormValues {
  logoUrl:         string
  primaryColour:   string
  secondaryColour: string
  accentColour:    string
}

const DEFAULTS: FormValues = {
  logoUrl:         '',
  primaryColour:   '#059669',
  secondaryColour: '#0f172a',
  accentColour:    '#f59e0b',
}

function toForm(theme: ReturnType<typeof useBusinessContext>['theme']): FormValues {
  if (!theme) return DEFAULTS
  return {
    logoUrl:         theme.logo_url          ?? '',
    primaryColour:   theme.primary_colour,
    secondaryColour: theme.secondary_colour,
    accentColour:    theme.accent_colour,
  }
}

// Validate that a string is a 6-digit hex colour prefixed with #
function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

interface ColourFieldProps {
  id:       string
  label:    string
  hint?:    string
  value:    string
  onChange: (value: string) => void
}

function ColourField({ id, label, hint, value, onChange }: ColourFieldProps) {
  const [text, setText] = useState(value)

  // Keep text in sync when value changes externally (e.g. reset)
  useEffect(() => { setText(value) }, [value])

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setText(raw)
    if (isValidHex(raw)) onChange(raw)
  }

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const hex = e.target.value
    setText(hex)
    onChange(hex)
  }

  const invalid = text.length > 0 && !isValidHex(text)

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        {/* Native colour picker — acts as the primary interaction */}
        <div className="relative flex-shrink-0">
          <input
            type="color"
            value={isValidHex(value) ? value : '#000000'}
            onChange={handlePickerChange}
            className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
            aria-label={`${label} colour picker`}
          />
        </div>
        {/* Hex text input */}
        <input
          id={id}
          type="text"
          value={text}
          onChange={handleTextChange}
          maxLength={7}
          placeholder="#000000"
          className={[
            'w-32 px-3 py-2 text-sm font-mono rounded-lg border transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-emerald-500 focus:border-transparent',
            invalid
              ? 'border-red-400 text-red-700'
              : 'border-slate-300 text-slate-900',
          ].join(' ')}
        />
        {/* Preview swatch */}
        <div
          className="flex-1 h-10 rounded-lg border border-slate-200"
          style={{ backgroundColor: isValidHex(value) ? value : '#e2e8f0' }}
          aria-hidden="true"
        />
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {invalid && <p className="text-xs text-red-600">Enter a valid hex colour, e.g. #059669</p>}
    </div>
  )
}

function Section({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card padding="lg">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </Card>
  )
}

export default function BrandingPage() {
  const { business, theme, reload } = useBusinessContext()
  const { can } = usePlan()
  const canCustomBranding = can('customBranding')

  const [form, setForm] = useState<FormValues>(() => toForm(theme))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const savedThemeRef = useRef(toForm(theme))

  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError,     setLogoError]     = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  async function handleLogoUpload(file: File) {
    if (!business) return
    if (!file.type.startsWith('image/')) { setLogoError('Please choose an image file (PNG or SVG recommended).'); return }
    if (file.size > 5 * 1024 * 1024) { setLogoError('File must be under 5 MB.'); return }
    setLogoError(null)
    setUploadingLogo(true)
    try {
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `${business.id}/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('pets').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('pets').getPublicUrl(path)
      setForm(prev => ({ ...prev, logoUrl: data.publicUrl }))
      if (saved) setSaved(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setLogoError(
        msg.toLowerCase().includes('bucket')
          ? 'Storage bucket not found — create a public bucket named "pets" in your Supabase Storage settings.'
          : msg
      )
    } finally {
      setUploadingLogo(false)
    }
  }

  // When context theme updates (after reload), re-sync form and saved reference
  useEffect(() => {
    const fresh = toForm(theme)
    setForm(fresh)
    savedThemeRef.current = fresh
  }, [theme])

  // Apply colour changes live to the page as the user edits
  function applyToDocument(primary: string, secondary: string, accent: string) {
    const root = document.documentElement
    if (isValidHex(primary))   root.style.setProperty('--brand-primary',   primary)
    if (isValidHex(secondary)) root.style.setProperty('--brand-secondary', secondary)
    if (isValidHex(accent))    root.style.setProperty('--brand-accent',    accent)
  }

  // On unmount without saving, restore the last-saved values
  useEffect(() => {
    return () => {
      const t = savedThemeRef.current
      applyToDocument(t.primaryColour, t.secondaryColour, t.accentColour)
    }
  }, [])

  function setColour(field: keyof FormValues) {
    return (value: string) => {
      setForm(prev => {
        const next = { ...prev, [field]: value }
        applyToDocument(next.primaryColour, next.secondaryColour, next.accentColour)
        return next
      })
      if (saved) setSaved(false)
    }
  }

  function hasInvalidColours() {
    return !isValidHex(form.primaryColour)
      || !isValidHex(form.secondaryColour)
      || !isValidHex(form.accentColour)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (hasInvalidColours()) return
    setSaveError(null)
    setSaving(true)

    const { error } = await supabase
      .from('business_theme')
      .upsert({
        business_id:      business!.id,
        primary_colour:   form.primaryColour,
        secondary_colour: form.secondaryColour,
        accent_colour:    form.accentColour,
        logo_url:         form.logoUrl.trim() || null,
      }, { onConflict: 'business_id' })

    setSaving(false)

    if (error) {
      setSaveError(error.message)
      return
    }

    setSaved(true)
    savedThemeRef.current = form
    reload()
    setTimeout(() => setSaved(false), 4000)
  }

  const logoPreviewValid = form.logoUrl.trim().startsWith('http')

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Branding"
        description="Customise how PawBoard looks for your business"
        backHref="/settings"
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        <Section
          title="Logo"
          description="Shown in the owner portal and on printouts — not yet visible in the staff app"
        >
          <div className="space-y-3">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleLogoUpload(file)
                e.target.value = ''  // allow re-selecting the same file
              }}
            />

            {logoPreviewValid ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <img
                  src={form.logoUrl}
                  alt="Logo preview"
                  className="h-12 w-auto max-w-[160px] object-contain rounded"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="flex items-center gap-2 ml-auto">
                  <Button type="button" variant="secondary" size="sm" icon={<Upload className="w-3.5 h-3.5" />}
                    loading={uploadingLogo} onClick={() => logoInputRef.current?.click()}>
                    Replace
                  </Button>
                  <Button type="button" variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5" />}
                    onClick={() => { setForm(prev => ({ ...prev, logoUrl: '' })); if (saved) setSaved(false) }}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors"
              >
                {uploadingLogo ? (
                  <span className="text-xs">Uploading…</span>
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-xs font-medium">Upload a logo (PNG or SVG, max 5 MB)</span>
                  </>
                )}
              </button>
            )}
            {logoError && <p className="text-xs text-red-600">{logoError}</p>}
          </div>
        </Section>

        {canCustomBranding ? (
          <Section
            title="Colours"
            description="Changes are previewed live — click Save to make them permanent"
          >
            <div className="space-y-5">
              <ColourField
                id="primary_colour"
                label="Primary colour"
                hint="Used for the logo, buttons, and active navigation. Choose your main brand colour."
                value={form.primaryColour}
                onChange={setColour('primaryColour')}
              />
              <ColourField
                id="secondary_colour"
                label="Secondary colour"
                hint="Used for headings and strong text in branded areas."
                value={form.secondaryColour}
                onChange={setColour('secondaryColour')}
              />
              <ColourField
                id="accent_colour"
                label="Accent colour"
                hint="Used for highlights and today indicators on the calendar."
                value={form.accentColour}
                onChange={setColour('accentColour')}
              />
            </div>
          </Section>
        ) : (
          <Card padding="lg">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Colours</h3>
            <PlanGate
              feature="Custom brand colours"
              requiredPlan="PawBoard Professional"
            />
          </Card>
        )}

        {/* Guardrails — be explicit about what is NOT customisable */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-600">What you can and cannot change</p>
          <p>Colours apply to the navigation, buttons and key brand elements only.</p>
          <p>Layout, fonts, spacing, and component structure are fixed to ensure the app stays clear and usable for all staff.</p>
        </div>

        <div className="flex items-center gap-4 pb-2">
          <div
            className="flex items-center gap-1.5 text-sm text-emerald-700 transition-opacity duration-300"
            style={{ opacity: saved ? 1 : 0 }}
            aria-live="polite"
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Changes saved
          </div>

          {saveError && (
            <p className="text-sm text-red-600 flex-1 text-right">{saveError}</p>
          )}

          <Button
            type="submit"
            loading={saving}
            disabled={hasInvalidColours()}
            className="ml-auto"
          >
            Save changes
          </Button>
        </div>

      </form>
    </div>
  )
}
