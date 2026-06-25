-- =============================================================================
-- PawBoard — Phase 17: Stay Journal
-- Migration: 20260626000001_stay_journal.sql
--
-- Staff log updates during a stay (photos, notes, meals, medication, walks,
-- wellbeing). Owners can optionally see them in the portal, controlled by a
-- per-business setting. Photos reuse the public `pets` storage bucket.
--
-- Apply via: Supabase Dashboard → SQL Editor → paste and run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Settings toggles
-- -----------------------------------------------------------------------------
alter table business_settings
  add column if not exists stay_journal_enabled       boolean not null default true,
  add column if not exists stay_journal_owner_visible boolean not null default false;

-- -----------------------------------------------------------------------------
-- 2. Journal entries
-- -----------------------------------------------------------------------------
create table if not exists stay_journal_entries (
  id           uuid        primary key default gen_random_uuid(),
  business_id  uuid        not null references businesses(id) on delete cascade,
  booking_id   uuid        not null references bookings(id)   on delete cascade,
  entry_type   text        not null default 'note'
    check (entry_type in ('photo', 'note', 'meal', 'medication', 'walk', 'wellbeing')),
  body         text,
  photo_url    text,
  author_label text,
  created_by   uuid        references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_journal_booking  on stay_journal_entries(booking_id);
create index if not exists idx_journal_business on stay_journal_entries(business_id, created_at desc);

alter table stay_journal_entries enable row level security;

-- Staff of the business manage entries.
drop policy if exists "journal_tenant_isolation" on stay_journal_entries;
create policy "journal_tenant_isolation" on stay_journal_entries for all
  using  (business_id = get_current_business_id())
  with check (business_id = get_current_business_id());

-- -----------------------------------------------------------------------------
-- 3. Portal owners may READ their own booking entries when the business has
--    made the journal visible. Extends portal_can() with a 'stay_journal' key.
-- -----------------------------------------------------------------------------
create or replace function portal_can(p_feature text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p_feature
             when 'pet_edits'        then bs.portal_allow_pet_edits
             when 'documents'        then bs.portal_allow_documents
             when 'booking_requests' then bs.portal_allow_booking_requests
             when 'stay_journal'     then bs.stay_journal_owner_visible
             else false
           end
    from owners o
    join business_settings bs on bs.business_id = o.business_id
    where o.portal_user_id = auth.uid()
      and o.is_active = true
      and bs.portal_enabled = true
    limit 1
  ), false);
$$;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'get_portal_owner_id') then
    drop policy if exists "journal_portal_select" on stay_journal_entries;
    create policy "journal_portal_select" on stay_journal_entries for select
      using (
        portal_can('stay_journal')
        and booking_id in (select id from bookings where owner_id = get_portal_owner_id())
      );
  end if;
end $$;

drop trigger if exists trg_journal_updated_at on stay_journal_entries;
create trigger trg_journal_updated_at
  before update on stay_journal_entries
  for each row execute function set_updated_at();
