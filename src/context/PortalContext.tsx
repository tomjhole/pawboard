import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Database } from '@/types/database'

type Owner           = Database['public']['Tables']['owners']['Row']
type Business        = Database['public']['Tables']['businesses']['Row']
type BusinessSettings = Database['public']['Tables']['business_settings']['Row']
type BusinessTheme   = Database['public']['Tables']['business_theme']['Row']

export type PortalState =
  | { status: 'loading' }
  | { status: 'not-portal' }            // signed-in user is not a linked owner
  | { status: 'disabled'; business: Business | null }  // linked, but portal turned off
  | {
      status:   'ready'
      owner:    Owner
      business: Business
      settings: BusinessSettings
      theme:    BusinessTheme | null
    }

interface PortalContextValue {
  state:    PortalState
  owner:    Owner | null
  business: Business | null
  settings: BusinessSettings | null
  reload:   () => void
}

const PortalContext = createContext<PortalContextValue | null>(null)

const THEME_DEFAULTS = {
  primary_colour:   '#059669',
  secondary_colour: '#0f172a',
  accent_colour:    '#f59e0b',
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<PortalState>({ status: 'loading' })
  const [tick,  setTick]  = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!user) { setState({ status: 'loading' }); return }
    let cancelled = false

    async function load() {
      setState({ status: 'loading' })

      // The owners RLS portal-select policy lets a linked owner read their own row
      // regardless of whether the portal is currently enabled.
      const { data: owner } = await supabase
        .from('owners')
        .select('*')
        .eq('portal_user_id', user!.id)
        .maybeSingle()

      if (cancelled) return
      if (!owner) { setState({ status: 'not-portal' }); return }

      const [bizRes, settingsRes, themeRes] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', owner.business_id).maybeSingle(),
        supabase.from('business_settings').select('*').eq('business_id', owner.business_id).maybeSingle(),
        supabase.from('business_theme').select('*').eq('business_id', owner.business_id).maybeSingle(),
      ])
      if (cancelled) return

      const settings = settingsRes.data
      if (!settings || !settings.portal_enabled) {
        setState({ status: 'disabled', business: bizRes.data ?? null })
        return
      }
      if (!bizRes.data) { setState({ status: 'not-portal' }); return }

      setState({
        status:   'ready',
        owner,
        business: bizRes.data,
        settings,
        theme:    themeRes.data ?? null,
      })
    }

    load()
    return () => { cancelled = true }
  }, [user, tick])

  // Apply branding while in the portal.
  useEffect(() => {
    const theme = state.status === 'ready' ? (state.theme ?? THEME_DEFAULTS) : THEME_DEFAULTS
    const root = document.documentElement
    root.style.setProperty('--brand-primary',   theme.primary_colour)
    root.style.setProperty('--brand-secondary', theme.secondary_colour)
    root.style.setProperty('--brand-accent',    theme.accent_colour)
  }, [state])

  const ready = state.status === 'ready' ? state : null

  return (
    <PortalContext.Provider value={{
      state,
      owner:    ready?.owner    ?? null,
      business: ready?.business ?? null,
      settings: ready?.settings ?? null,
      reload,
    }}>
      {children}
    </PortalContext.Provider>
  )
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext)
  if (!ctx) throw new Error('usePortal must be used within PortalProvider')
  return ctx
}
