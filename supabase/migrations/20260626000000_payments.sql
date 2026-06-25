-- =============================================================================
-- PawBoard — Phase 18: Payments (manual + Stripe Checkout)
-- Migration: 20260626000000_payments.sql
--
-- A simple payment ledger plus per-business payment configuration. Manual
-- payments (cash / bank transfer) work entirely client-side. Stripe Checkout
-- additionally requires the two Edge Functions in supabase/functions/ to be
-- deployed with your Stripe keys (see those files' headers). No Stripe Connect.
--
-- Apply via: Supabase Dashboard → SQL Editor → paste and run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Payment configuration on business_settings
-- -----------------------------------------------------------------------------
alter table business_settings
  add column if not exists payments_enabled                boolean       not null default true,
  add column if not exists stripe_enabled                  boolean       not null default false,
  add column if not exists stripe_test_mode                boolean       not null default true,   -- sandbox
  add column if not exists deposit_type                    text          not null default 'percentage',
  add column if not exists deposit_value                   numeric(10,2) not null default 20,
  add column if not exists bank_transfer_details           text,
  add column if not exists require_balance_before_checkout boolean       not null default false;

-- Guarded check constraint for deposit_type
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'business_settings_deposit_type_check') then
    alter table business_settings
      add constraint business_settings_deposit_type_check
      check (deposit_type in ('percentage', 'fixed'));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Payments ledger
-- -----------------------------------------------------------------------------
create table if not exists payments (
  id          uuid          primary key default gen_random_uuid(),
  business_id uuid          not null references businesses(id) on delete cascade,
  booking_id  uuid          not null references bookings(id)   on delete cascade,
  amount      numeric(10,2) not null check (amount >= 0),
  method      text          not null check (method in ('cash', 'bank_transfer', 'stripe')),
  kind        text          not null default 'other' check (kind in ('deposit', 'balance', 'full', 'other', 'refund')),
  status      text          not null default 'paid'  check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  notes       text,
  paid_at     timestamptz,
  created_by  uuid          references auth.users(id),
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index        if not exists idx_payments_booking  on payments(booking_id);
create index        if not exists idx_payments_business on payments(business_id);
create unique index if not exists idx_payments_session  on payments(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table payments enable row level security;

-- Staff of the business manage payments.
drop policy if exists "payments_tenant_isolation" on payments;
create policy "payments_tenant_isolation" on payments for all
  using  (business_id = get_current_business_id())
  with check (business_id = get_current_business_id());

-- Portal owners may READ payments on their own bookings (added in Phase 15).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'get_portal_owner_id') then
    drop policy if exists "payments_portal_select" on payments;
    create policy "payments_portal_select" on payments for select
      using (booking_id in (select id from bookings where owner_id = get_portal_owner_id()));
  end if;
end $$;

drop trigger if exists trg_payments_updated_at on payments;
create trigger trg_payments_updated_at
  before update on payments
  for each row execute function set_updated_at();
