-- =============================================================================
-- PawBoard — Feeding & exercise care checklist
-- Migration: 20260624000005_care_checklist.sql
-- =============================================================================

-- How many times per day a pet is fed (1–4), default 2
alter table pets
  add column if not exists feeds_per_day integer not null default 2
  constraint pets_feeds_per_day_check check (feeds_per_day between 1 and 4);

-- Per-stay override confirmed at check-in (null = use pet default)
alter table booking_pets
  add column if not exists feeds_per_day integer
  constraint booking_pets_feeds_per_day_check check (feeds_per_day between 1 and 4);

-- ─── Daily care log ───────────────────────────────────────────────────────────

create table if not exists daily_care_log (
  id              uuid        primary key default gen_random_uuid(),
  business_id     uuid        not null references businesses(id) on delete cascade,
  booking_pet_id  uuid        not null references booking_pets(id) on delete cascade,
  log_date        date        not null,
  care_type       text        not null,
  completed_at    timestamptz not null default now(),
  completed_by    uuid        references auth.users(id) on delete set null,
  constraint daily_care_log_unique unique (booking_pet_id, log_date, care_type),
  constraint daily_care_log_care_type_check check (
    care_type in ('feed_1', 'feed_2', 'feed_3', 'feed_4', 'exercise')
  )
);

alter table daily_care_log enable row level security;

drop policy if exists "Business members can manage care log" on daily_care_log;
create policy "Business members can manage care log"
  on daily_care_log for all
  using  (business_id = get_current_business_id())
  with check (business_id = get_current_business_id());
