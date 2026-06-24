-- =============================================================================
-- PawBoard — Pricing tables
-- Migration: 20260624000000_pricing.sql
--
-- Apply via: Supabase Dashboard → SQL Editor → paste and run
-- =============================================================================

-- booking_extras_catalog already exists from a partial run — add charge_frequency, remove unit_label
alter table booking_extras_catalog
  add column if not exists charge_frequency text not null default 'once'
    check (charge_frequency in ('once', 'nightly', 'daily'));

alter table booking_extras_catalog
  drop column if exists unit_label;

-- booking_line_items
create table if not exists booking_line_items (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  description text not null,
  quantity    numeric(10,2) not null default 1,
  unit_price  numeric(10,2) not null,
  total_price numeric(10,2) not null,
  source      text not null default 'custom' check (source in ('rate', 'extra', 'custom')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table booking_line_items enable row level security;

drop policy if exists "owner access" on booking_line_items;
create policy "owner access" on booking_line_items
  using (booking_id in (
    select id from bookings where business_id in (
      select business_id from staff_users where id = auth.uid()
    )
  ));

-- Columns on existing tables
alter table bookings add column if not exists total_amount numeric(10,2);

alter table pets add column if not exists size text
  check (size in ('toy', 'small', 'medium', 'large', 'giant'));
