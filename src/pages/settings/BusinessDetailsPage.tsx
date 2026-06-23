import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBusinessContext } from '@/context/BusinessContext'
import { Input, Textarea, Button, PageHeader, Card } from '@/components/ui'
import type { Database } from '@/types/database'

type Business = Database['public']['Tables']['businesses']['Row']

interface FormValues {
  name: string
  email: string
  phone: string
  website: string
  address_line1: string
  address_line2: string
  city: string
  postcode: string
  country: string
  licence_number: string
  vat_number: string
  notes: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

function toForm(b: Business): FormValues {
  return {
    name:           b.name,
    email:          b.email           ?? '',
    phone:          b.phone           ?? '',
    website:        b.website         ?? '',
    address_line1:  b.address_line1   ?? '',
    address_line2:  b.address_line2   ?? '',
    city:           b.city            ?? '',
    postcode:       b.postcode        ?? '',
    country:        b.country,
    licence_number: b.licence_number  ?? '',
    vat_number:     b.vat_number      ?? '',
    notes:          b.notes           ?? '',
  }
}

function validate(f: FormValues): FormErrors {
  const errors: FormErrors = {}

  if (!f.name.trim()) {
    errors.name = 'Business name is required.'
  } else if (f.name.trim().length < 2) {
    errors.name = 'Business name must be at least 2 characters.'
  }

  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
    errors.email = 'Please enter a valid email address.'
  }

  if (f.website.trim() && !/^https?:\/\/.+\..+/.test(f.website.trim())) {
    errors.website = 'Website must start with https:// or http://'
  }

  return errors
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

export default function BusinessDetailsPage() {
  const { business, reload } = useBusinessContext()
  const [form, setForm] = useState<FormValues>(() => toForm(business!))
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function field(key: keyof FormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }))
      if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
      if (saved) setSaved(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)

    const fieldErrors = validate(form)
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('businesses')
      .update({
        name:           form.name.trim(),
        email:          form.email.trim()           || null,
        phone:          form.phone.trim()            || null,
        website:        form.website.trim()          || null,
        address_line1:  form.address_line1.trim()    || null,
        address_line2:  form.address_line2.trim()    || null,
        city:           form.city.trim()             || null,
        postcode:       form.postcode.trim()         || null,
        country:        form.country.trim()          || 'GB',
        licence_number: form.licence_number.trim()   || null,
        vat_number:     form.vat_number.trim()       || null,
        notes:          form.notes.trim()            || null,
      })
      .eq('id', business!.id)

    setSaving(false)

    if (error) {
      setSaveError(error.message)
      return
    }

    setSaved(true)
    reload()
    setTimeout(() => setSaved(false), 4000)
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Business details"
        description="Your business name, contact information and address"
        backHref="/settings"
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        <Section title="Contact information">
          <div className="space-y-4">
            <Input
              id="name"
              label="Business name"
              value={form.name}
              onChange={field('name')}
              error={errors.name}
              required
              autoComplete="organization"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="email"
                type="email"
                label="Email address"
                value={form.email}
                onChange={field('email')}
                error={errors.email}
                placeholder="hello@yourkennels.co.uk"
                autoComplete="email"
              />
              <Input
                id="phone"
                type="tel"
                label="Phone number"
                value={form.phone}
                onChange={field('phone')}
                placeholder="01234 567890"
                autoComplete="tel"
              />
            </div>
            <Input
              id="website"
              type="url"
              label="Website"
              value={form.website}
              onChange={field('website')}
              error={errors.website}
              placeholder="https://www.yourkennels.co.uk"
              autoComplete="url"
            />
          </div>
        </Section>

        <Section title="Address">
          <div className="space-y-4">
            <Input
              id="address_line1"
              label="Address line 1"
              value={form.address_line1}
              onChange={field('address_line1')}
              placeholder="123 Kennel Lane"
              autoComplete="address-line1"
            />
            <Input
              id="address_line2"
              label="Address line 2"
              value={form.address_line2}
              onChange={field('address_line2')}
              placeholder="Village or area (optional)"
              autoComplete="address-line2"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  id="city"
                  label="Town / City"
                  value={form.city}
                  onChange={field('city')}
                  placeholder="Anytown"
                  autoComplete="address-level2"
                />
              </div>
              <Input
                id="postcode"
                label="Postcode"
                value={form.postcode}
                onChange={field('postcode')}
                placeholder="AB1 2CD"
                autoComplete="postal-code"
              />
            </div>
            <Input
              id="country"
              label="Country"
              value={form.country}
              onChange={field('country')}
              hint="Use an ISO country code, e.g. GB, IE, US"
              autoComplete="country"
            />
          </div>
        </Section>

        <Section
          title="Legal &amp; regulatory"
          description="Used on invoices and compliance documents"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="licence_number"
              label="Boarding licence number"
              value={form.licence_number}
              onChange={field('licence_number')}
              placeholder="e.g. ABC/2024/00123"
              hint="Issued by your local council"
            />
            <Input
              id="vat_number"
              label="VAT number"
              value={form.vat_number}
              onChange={field('vat_number')}
              placeholder="GB 123 4567 89"
            />
          </div>
        </Section>

        <Section
          title="Opening notes"
          description="Shown to owners — opening hours, directions, drop-off instructions"
        >
          <Textarea
            id="notes"
            label="Notes"
            value={form.notes}
            onChange={field('notes')}
            rows={5}
            placeholder="e.g. We are open Monday to Saturday, 8am–6pm. Please use the side entrance on Kennel Lane and ring the bell on arrival…"
          />
        </Section>

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

          <Button type="submit" loading={saving} className="ml-auto">
            Save changes
          </Button>
        </div>

      </form>
    </div>
  )
}
