# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # tsc -b && vite build (type-check is part of the build)
npm run lint       # ESLint
npm run preview    # Preview the production build locally
```

There are no automated tests. TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`) enforces correctness at build time — unused imports are build errors.

## Architecture

### Auth + context hierarchy

The app has two completely separate user types, each with their own context and shell:

- **Staff users** — kennel employees. `AuthContext` (Supabase session) → `BusinessContext` (staff_users record, business, settings, theme, plan). All staff pages live under `AppShell`.
- **Portal users** — pet owners accessing their own data. `PortalContext` loads the owner record and applies custom CSS variables for branded theming (`--brand-primary` etc.). Portal pages live under `PortalShell` at `/portal/*`.

`RequireAuth`, `RequireBusiness`, and `RequireRole` guards in `src/components/auth/` enforce access at the route level. `RequireBusiness` is where non-staff users get redirected to onboarding, the portal, or admin.

Platform admins have a "view override" mechanism: `set_admin_view` RPC switches which business the admin sees, without re-authenticating.

### Plan / feature gating

`src/lib/plans.ts` defines three tiers: `diary` → `professional` → `premium`. Each tier has numeric limits (`maxSpaces`, `maxStaffUsers`, etc.) and boolean feature flags (`ownerPortal`, `stayJournal`, `pricingEngine`, etc.).

```ts
const { can, within, atLeast, limit } = usePlan()
can('ownerPortal')          // boolean feature check
within('maxSpaces', count)  // limit check
atLeast('professional')     // minimum tier check
```

`<PlanGate requires="professional">` wraps gated UI — shows an amber upgrade prompt if the business is below the required tier.

### database.ts — manual maintenance required

`src/types/database.ts` is **manually maintained**, not auto-generated. After any migration that adds tables or RPC functions, these types must be updated by hand. Failing to do so causes TypeScript errors on Vercel (`.from('new_table')` and `.rpc('new_fn')` calls are type-checked against this file). Add new tables to the `Tables` section and new RPCs to the `Functions` section following the existing Row/Insert/Update pattern.

### Supabase client

```ts
// src/lib/supabase.ts
export const supabase = createClient<Database>(url, anonKey)
```

All DB access goes through this typed client. RLS policies on the server enforce row-level isolation per business. The `get_current_business_id()` RPC is the foundation of all RLS policies — it reads from the current session's `staff_users` record.

### Audit logging and notifications — never throw

`logAudit()` (`src/lib/audit.ts`) and `notify()` (`src/lib/notify.ts`) are designed as fire-and-forget. They catch all errors internally and must never cause the calling action to fail. Follow this same pattern for any future side-effects.

```ts
// safe to call without await or try/catch
logAudit(businessId, { action: 'booking.updated', entity_type: 'booking', entity_id: id, before, after })
notify('booking_confirmation', { businessId, relatedId: bookingId })
```

`notify()` invokes the `send-email` Supabase Edge Function. The function checks `business_settings` toggles server-side before sending — no need to check plan/settings in the client before calling `notify()`.

### Edge functions

All Edge Functions are in `supabase/functions/` (Deno runtime). Shared utilities (CORS headers, Resend email helper) live in `supabase/functions/_shared/`. Deploy with:

```bash
supabase functions deploy <function-name>
# send-reminders needs: --no-verify-jwt (called by cron, not a user)
```

Required secrets: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `APP_URL`, `STRIPE_SECRET_KEY_TEST`, `STRIPE_SECRET_KEY_LIVE`, `STRIPE_WEBHOOK_SECRET`.

### Routing

`src/App.tsx` defines all routes. Staff routes require `RequireAuth` + `RequireBusiness`. Settings routes additionally require `RequireRole` (owner or manager only). Portal routes use a separate `PortalProvider` context. The root `/` redirects to `/calendar`.

### Key booking status conventions

- `computeDisplayStatus(stored, hasOutstanding)` and `hasOutstandingDetails(booking)` are exported from `src/pages/BookingsPage.tsx` and used across the app — don't duplicate this logic.
- `INTENT_STATUS_SET = new Set(['enquiry', 'provisional', 'confirmed', 'waiting_list'])` — statuses representing active intent (used for occupancy calculations).
- Vaccination `is_verified` is the authoritative boolean — not `verified_at`.

### Payments

`src/lib/payments.ts` handles deposit calculation, payment totalling, and syncing `deposit_paid`/`balance_paid` timestamps on bookings. `syncBookingPaymentFlags(bookingId, kind)` must be called after any payment is recorded or deleted to keep booking flags accurate.

### Stay Journal offline queue

`src/lib/journalQueue.ts` uses IndexedDB to queue photo uploads when offline. Blobs persist across page reloads and flush automatically when connectivity is restored. The queue is keyed to the `pawboard` IndexedDB database, `journal_queue` store.

## Deployment

- **Vercel** at `https://pawboard-psi.vercel.app` — `vercel.json` has the SPA catch-all rewrite required for React Router.
- **Required Vercel env vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (not in `.env.local` which is gitignored).
- **Supabase Auth URL config**: Site URL and Redirect URLs in the Supabase dashboard must point to the Vercel domain for email links to work.

## Pending schema gaps

The following tables exist in production via `seed_demo.sql` `CREATE TABLE IF NOT EXISTS` but have **no tracked migration file**: `pricing_settings`, `pricing_rates`, `pricing_sharing_rules`, `booking_extras_catalog`, `vaccination_types`. These need proper migrations before any clean production DB rebuild.
