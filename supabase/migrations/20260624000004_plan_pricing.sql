-- =============================================================================
-- PawBoard — Plan pricing (configurable by admin) + admin plan-change function
-- Migration: 20260624000004_plan_pricing.sql
-- =============================================================================

-- Global plan pricing — one row per plan, editable by platform admins
create table if not exists plan_pricing (
  plan_id       text        primary key check (plan_id in ('diary', 'professional', 'premium')),
  price_monthly numeric(10,2) not null,
  currency      char(3)     not null default 'GBP',
  is_active     boolean     not null default true,
  updated_at    timestamptz not null default now()
);

-- Seed default prices (idempotent)
insert into plan_pricing (plan_id, price_monthly, currency) values
  ('diary',        5.00, 'GBP'),
  ('professional', 29.00, 'GBP'),
  ('premium',      69.00, 'GBP')
on conflict (plan_id) do nothing;

-- RLS: anyone authenticated can read pricing (it's public info)
alter table plan_pricing enable row level security;

drop policy if exists "Authenticated users can read plan pricing" on plan_pricing;
create policy "Authenticated users can read plan pricing"
  on plan_pricing for select
  using (auth.role() = 'authenticated');

-- ─── Admin functions ──────────────────────────────────────────────────────────

-- Set the subscription plan for any business (admin only)
create or replace function set_business_plan_admin(
  p_business_id uuid,
  p_plan        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'Not a platform admin';
  end if;

  if p_plan not in ('diary', 'professional', 'premium') then
    raise exception 'Invalid plan: %. Must be diary, professional or premium', p_plan;
  end if;

  update businesses
  set subscription_plan = p_plan::subscription_plan,
      updated_at        = now()
  where id = p_business_id;
end;
$$;

-- Update the price for a plan (admin only)
create or replace function update_plan_pricing(
  p_plan_id  text,
  p_price    numeric,
  p_currency text default 'GBP'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'Not a platform admin';
  end if;

  if p_plan_id not in ('diary', 'professional', 'premium') then
    raise exception 'Invalid plan_id: %', p_plan_id;
  end if;

  if p_price < 0 then
    raise exception 'Price cannot be negative';
  end if;

  update plan_pricing
  set price_monthly = p_price,
      currency      = upper(p_currency),
      updated_at    = now()
  where plan_id = p_plan_id;
end;
$$;

grant execute on function set_business_plan_admin(uuid, text)         to authenticated;
grant execute on function update_plan_pricing(text, numeric, text)     to authenticated;
