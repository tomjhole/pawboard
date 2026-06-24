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
      staffUser: StaffUser | null
      business: Business
      settings: BusinessSettings | null
      theme: BusinessTheme | null
    }

interface BusinessContextValue {
  state: BusinessState
  staffUser: StaffUser | null
  business: Business | null
  settings: BusinessSettings | null
  theme: BusinessTheme | null
  isAdmin: boolean
  reload: () => void
  switchBusiness: (id: string) => Promise<void>
  clearAdminView: () => Promise<void>
}

const BusinessContext = createContext<BusinessContextValue | null>(null)

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state,   setState]   = useState<BusinessState>({ status: 'loading' })
  const [isAdmin, setIsAdmin] = useState(false)
  const [tick,    setTick]    = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  const switchBusiness = useCallback(async (id: string) => {
    await supabase.rpc('set_admin_view', { target_business_id: id })
    reload()
  }, [reload])

  const clearAdminView = useCallback(async () => {
    await supabase.rpc('set_admin_view', { target_business_id: null })
    reload()
  }, [reload])

  useEffect(() => {
    if (!user) {
      setState({ status: 'loading' })
      return
    }

    let cancelled = false

    async function load() {
      setState({ status: 'loading' })

      // Check admin status and own staff record in parallel
      const [adminRes, staffRes] = await Promise.all([
        supabase.rpc('is_platform_admin'),
        supabase
          .from('staff_users')
          .select('*')
          .eq('id', user!.id)
          .eq('is_active', true)
          .single(),
      ])

      if (cancelled) return

      const userIsAdmin = adminRes.data === true
      setIsAdmin(userIsAdmin)

      let businessId: string | null = null

      if (userIsAdmin) {
        // Admin: check if they have a view override set
        const { data: overrideId } = await supabase.rpc('get_admin_view_business_id')
        if (cancelled) return

        if (overrideId) {
          businessId = overrideId
        } else if (staffRes.data) {
          // Admin has their own business — use it as default
          businessId = staffRes.data.business_id
        } else {
          // Admin with no business selected and no own business → send to /admin
          setState({ status: 'no-staff-record' })
          return
        }
      } else {
        // Normal user
        if (!staffRes.data) {
          if (staffRes.error?.code === 'PGRST116') {
            setState({ status: 'no-staff-record' })
          } else {
            setState({
              status: 'error',
              message: staffRes.error?.message ?? 'Failed to load your staff account.',
            })
          }
          return
        }
        businessId = staffRes.data.business_id
      }

      if (!businessId) {
        setState({ status: 'no-staff-record' })
        return
      }

      // Load business, settings and theme in parallel
      const [bizResult, settingsResult, themeResult] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', businessId).single(),
        supabase.from('business_settings').select('*').eq('business_id', businessId).maybeSingle(),
        supabase.from('business_theme').select('*').eq('business_id', businessId).maybeSingle(),
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
        // staffUser may be null when admin is viewing a different business
        staffUser: staffRes.data ?? null,
        business:  bizResult.data,
        settings:  settingsResult.data ?? null,
        theme:     themeResult.data ?? null,
      })
    }

    load()
    return () => { cancelled = true }
  }, [user, tick])

  const ready = state.status === 'ready' ? state : null

  return (
    <BusinessContext.Provider value={{
      state,
      staffUser:      ready?.staffUser ?? null,
      business:       ready?.business  ?? null,
      settings:       ready?.settings  ?? null,
      theme:          ready?.theme     ?? null,
      isAdmin,
      reload,
      switchBusiness,
      clearAdminView,
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
