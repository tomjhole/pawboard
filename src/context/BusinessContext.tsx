import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Database } from '@/types/database'

type StaffUser = Database['public']['Tables']['staff_users']['Row']
type Business = Database['public']['Tables']['businesses']['Row']
type BusinessSettings = Database['public']['Tables']['business_settings']['Row']
type BusinessTheme = Database['public']['Tables']['business_theme']['Row']

export type BusinessState =
  | { status: 'loading' }
  | { status: 'no-staff-record' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      staffUser: StaffUser
      business: Business
      settings: BusinessSettings | null
      theme: BusinessTheme | null
    }

interface BusinessContextValue {
  state: BusinessState
  // Flat convenience accessors — null unless state.status === 'ready'
  staffUser: StaffUser | null
  business: Business | null
  settings: BusinessSettings | null
  theme: BusinessTheme | null
  // Call after mutating business data to refresh context
  reload: () => void
}

const BusinessContext = createContext<BusinessContextValue | null>(null)

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<BusinessState>({ status: 'loading' })
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!user) {
      setState({ status: 'loading' })
      return
    }

    let cancelled = false

    async function load() {
      setState({ status: 'loading' })

      // Load staff user — PGRST116 means no matching row
      const { data: staffUser, error: staffError } = await supabase
        .from('staff_users')
        .select('*')
        .eq('id', user!.id)
        .eq('is_active', true)
        .single()

      if (cancelled) return

      if (!staffUser) {
        if (staffError?.code === 'PGRST116') {
          setState({ status: 'no-staff-record' })
        } else {
          setState({
            status: 'error',
            message: staffError?.message ?? 'Failed to load your staff account.',
          })
        }
        return
      }

      // Load business, settings and theme in parallel
      const [bizResult, settingsResult, themeResult] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', staffUser.business_id).single(),
        supabase.from('business_settings').select('*').eq('business_id', staffUser.business_id).maybeSingle(),
        supabase.from('business_theme').select('*').eq('business_id', staffUser.business_id).maybeSingle(),
      ])

      if (cancelled) return

      if (!bizResult.data) {
        setState({
          status: 'error',
          message: bizResult.error?.message ?? 'Failed to load business data.',
        })
        return
      }

      setState({
        status: 'ready',
        staffUser,
        business: bizResult.data,
        settings: settingsResult.data ?? null,
        theme: themeResult.data ?? null,
      })
    }

    load()
    return () => { cancelled = true }
  }, [user, tick])

  const ready = state.status === 'ready' ? state : null

  return (
    <BusinessContext.Provider value={{
      state,
      staffUser: ready?.staffUser ?? null,
      business:  ready?.business  ?? null,
      settings:  ready?.settings  ?? null,
      theme:     ready?.theme     ?? null,
      reload,
    }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusinessContext(): BusinessContextValue {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusinessContext must be used within BusinessProvider')
  return ctx
}
