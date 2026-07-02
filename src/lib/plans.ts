import { useBusinessContext } from '@/context/BusinessContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanId = 'diary' | 'professional' | 'premium'

export type PlanLimits = {
  // ── Numeric limits (null = unlimited) ──────────────────────────────────────
  maxSpaces:         number | null  // bookable spaces
  maxAreas:          number | null  // accommodation areas / locations
  maxStaffUsers:     number | null  // staff user accounts
  maxOwners:         number | null  // owner records
  maxCustomSpecies:  number | null  // user-defined species beyond dogs & cats

  // ── Active features ────────────────────────────────────────────────────────
  calendarFilters:   boolean  // full filter panel on calendar/occupancy views
  occupancyView:     boolean  // occupancy histogram tab
  customSpecies:     boolean  // can add any custom species at all
  customBranding:    boolean  // custom brand colours (logo available on all plans)
  pricingEngine:     boolean  // rates, sharing rules, line items
  emailReminders:    boolean  // automatic arrival & vaccination-expiry reminder emails

  // ── Future features (gates in place; features not yet built) ───────────────
  onlineBooking:     boolean  // owner-facing online booking requests
  ownerPortal:       boolean  // owner portal — view bookings, upload docs
  customForms:       boolean  // custom intake / check-in forms
  stripePayments:    boolean  // Stripe Connect for deposits / full payment
  stayJournal:       boolean  // Stay Journal — photos & updates during stay
  advancedReporting: boolean  // occupancy trends, revenue reports, export
  multipleLocations: boolean  // multiple physical sites under one account
  customDomain:      boolean  // white-label custom domain
  whiteLabelling:    boolean  // remove PawBoard branding entirely
  advancedRoles:     boolean  // granular per-staff permission sets
}

export type PlanFeature = keyof {
  [K in keyof PlanLimits as PlanLimits[K] extends boolean ? K : never]: true
}

export type PlanLimitKey = keyof {
  [K in keyof PlanLimits as PlanLimits[K] extends number | null ? K : never]: true
}

export type Plan = {
  id:            PlanId
  name:          string
  priceMonthly:  number
  description:   string
  limits:        PlanLimits
}

// ─── Plan definitions ─────────────────────────────────────────────────────────

export const PLANS: Record<PlanId, Plan> = {

  // £5/month — single-location home boarding or micro-kennel
  diary: {
    id:           'diary',
    name:         'PawBoard Diary',
    priceMonthly: 5,
    description:  'The digital paper diary. Perfect for home boarding and small operations.',
    limits: {
      maxSpaces:         5,
      maxAreas:          1,
      maxStaffUsers:     1,
      maxOwners:         150,
      maxCustomSpecies:  0,

      calendarFilters:   false,
      occupancyView:     false,
      customSpecies:     false,
      customBranding:    false,
      pricingEngine:     false,
      emailReminders:    false,

      onlineBooking:     false,
      ownerPortal:       false,
      customForms:       false,
      stripePayments:    false,
      stayJournal:       false,
      advancedReporting: false,
      multipleLocations: false,
      customDomain:      false,
      whiteLabelling:    false,
      advancedRoles:     false,
    },
  },

  // £29/month — established kennel with staff and multiple areas
  professional: {
    id:           'professional',
    name:         'PawBoard Professional',
    priceMonthly: 29,
    description:  'For established kennels: staff accounts, pricing, occupancy and reporting.',
    limits: {
      maxSpaces:         30,
      maxAreas:          10,
      maxStaffUsers:     null,   // unlimited
      maxOwners:         null,   // unlimited
      maxCustomSpecies:  2,

      calendarFilters:   true,
      occupancyView:     true,
      customSpecies:     true,
      customBranding:    true,
      pricingEngine:     true,
      emailReminders:    false,  // Premium

      // Owner-facing features live in Premium
      onlineBooking:     false,  // Premium
      ownerPortal:       false,  // Premium
      stripePayments:    false,  // Premium
      stayJournal:       false,  // Premium
      advancedReporting: false,  // Premium (standard reporting is available)

      // Not built yet — kept as flags for the future, not shown in plan descriptions
      customForms:       false,
      multipleLocations: false,
      customDomain:      false,
      whiteLabelling:    false,
      advancedRoles:     false,
    },
  },

  // £69/month — full-featured for larger operations
  premium: {
    id:           'premium',
    name:         'PawBoard Premium',
    priceMonthly: 69,
    description:  'Take it online — owner portal, online bookings, Stay Journal, card payments and advanced reports.',
    limits: {
      maxSpaces:         null,
      maxAreas:          null,
      maxStaffUsers:     null,
      maxOwners:         null,
      maxCustomSpecies:  null,

      calendarFilters:   true,
      occupancyView:     true,
      customSpecies:     true,
      customBranding:    true,
      pricingEngine:     true,
      emailReminders:    true,

      onlineBooking:     true,
      ownerPortal:       true,
      stripePayments:    true,
      stayJournal:       true,
      advancedReporting: true,

      // Not built yet — kept as flags for the future, not shown in plan descriptions
      customForms:       false,
      multipleLocations: false,
      customDomain:      false,
      whiteLabelling:    false,
      advancedRoles:     false,
    },
  },
}

// Plan order — used for "at least" comparisons
const PLAN_ORDER: PlanId[] = ['diary', 'professional', 'premium']

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function getPlan(planId: PlanId): Plan {
  return PLANS[planId]
}

export function getLimits(planId: PlanId): PlanLimits {
  return PLANS[planId].limits
}

/** True if planId is at least as capable as minPlan (e.g. professional >= diary). */
export function atLeastPlan(planId: PlanId, minPlan: PlanId): boolean {
  return PLAN_ORDER.indexOf(planId) >= PLAN_ORDER.indexOf(minPlan)
}

/** True if the plan has the given boolean feature enabled. */
export function planHasFeature(planId: PlanId, feature: PlanFeature): boolean {
  return PLANS[planId].limits[feature] as boolean
}

/**
 * True if currentCount is within the plan's numeric limit for limitKey.
 * null limit means unlimited — always returns true.
 */
export function withinPlanLimit(planId: PlanId, limitKey: PlanLimitKey, currentCount: number): boolean {
  const limit = PLANS[planId].limits[limitKey] as number | null
  return limit === null || currentCount < limit
}

/** "10" or "Unlimited" — for display. */
export function formatLimit(planId: PlanId, limitKey: PlanLimitKey): string {
  const limit = PLANS[planId].limits[limitKey] as number | null
  return limit === null ? 'Unlimited' : String(limit)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type UsePlanReturn = {
  plan:    Plan
  planId:  PlanId
  /** True if the current plan has `feature` enabled */
  can:     (feature: PlanFeature) => boolean
  /** True if currentCount is below the plan's limit for limitKey */
  within:  (limitKey: PlanLimitKey, currentCount: number) => boolean
  /** True if the current plan is at least as capable as minPlan */
  atLeast: (minPlan: PlanId) => boolean
  /** Human-readable limit string, e.g. "10" or "Unlimited" */
  limit:   (limitKey: PlanLimitKey) => string
}

export function usePlan(): UsePlanReturn {
  const { business } = useBusinessContext()
  const planId = (business?.subscription_plan ?? 'diary') as PlanId
  const plan   = PLANS[planId]

  return {
    plan,
    planId,
    can:     feature             => planHasFeature(planId, feature),
    within:  (limitKey, count)   => withinPlanLimit(planId, limitKey, count),
    atLeast: minPlan             => atLeastPlan(planId, minPlan),
    limit:   limitKey            => formatLimit(planId, limitKey),
  }
}
