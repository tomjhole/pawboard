-- =============================================================================
-- PawBoard — Daily operations notes (one staff handover note per day)
-- Migration: 20260624000006_daily_notes.sql
-- =============================================================================

create table if not exists daily_notes (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references businesses(id) on delete cascade,
  log_date    date        not null,
  note_text   text        not null default '',
  updated_at  timestamptz not null default now(),
  constraint daily_notes_unique unique (business_id, log_date)
);

alter table daily_notes enable row level security;

drop policy if exists "Business members can manage daily notes" on daily_notes;
create policy "Business members can manage daily notes"
  on daily_notes for all
  using  (business_id = get_current_business_id())
  with check (business_id = get_current_business_id());
