-- =============================================================================
-- PawBoard — Phase 15: Owner Portal
-- Migration: 20260625000000_owner_portal.sql
--
-- Adds an optional, self-service portal for pet owners. Owners are linked to an
-- existing `owners` record via an invite link (mirrors the staff-invite flow).
-- A linked owner can see ONLY their own data, gated by additive RLS policies
-- that sit alongside the existing staff (tenant-isolation) policies.
--
-- Apply via: Supabase Dashboard → SQL Editor → paste and run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Feature toggles on business_settings
-- -----------------------------------------------------------------------------
alter table business_settings
  add column if not exists portal_enabled                boolean not null default false,
  add column if not exists portal_allow_pet_edits        boolean not null default true,
  add column if not exists portal_allow_documents        boolean not null default true,
  add column if not exists portal_allow_booking_requests boolean not null default true;

-- -----------------------------------------------------------------------------
-- 2. Owner portal invites (token-based, no email sending — staff share the link)
-- -----------------------------------------------------------------------------
create table if not exists owner_portal_invites (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references businesses(id) on delete cascade,
  owner_id    uuid        not null references owners(id)     on delete cascade,
  email       text        not null,
  token       uuid        not null unique default gen_random_uuid(),
  invited_by  uuid        references auth.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz
);

create index if not exists idx_owner_portal_invites_owner ON owner_portal_invites(owner_id);
create index if not exists idx_owner_portal_invites_token ON owner_portal_invites(token);

alter table owner_portal_invites enable row level security;

-- Staff of the business manage invites; the accept flow uses a SECURITY DEFINER
-- RPC, so invitees don't need a direct policy here.
drop policy if exists "owner_portal_invites_staff" on owner_portal_invites;
create policy "owner_portal_invites_staff" on owner_portal_invites for all
  using  (business_id = get_current_business_id())
  with check (business_id = get_current_business_id());

-- -----------------------------------------------------------------------------
-- 3. Helper functions (SECURITY DEFINER — resolve the caller's portal identity)
-- -----------------------------------------------------------------------------

-- The owner record this portal user is linked to — but ONLY when the business
-- has the portal switched on. Returns null otherwise (locks all portal data).
create or replace function get_portal_owner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select o.id
  from owners o
  join business_settings bs on bs.business_id = o.business_id
  where o.portal_user_id = auth.uid()
    and o.is_active = true
    and bs.portal_enabled = true
  limit 1;
$$;

-- Whether a specific portal feature is enabled for the caller's business.
create or replace function portal_can(p_feature text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p_feature
             when 'pet_edits'        then bs.portal_allow_pet_edits
             when 'documents'        then bs.portal_allow_documents
             when 'booking_requests' then bs.portal_allow_booking_requests
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

grant execute on function get_portal_owner_id()    to authenticated;
grant execute on function portal_can(text)         to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Additive RLS for portal owners
--    Permissive policies combine with OR, so these grant portal owners access
--    WITHOUT affecting the existing staff tenant-isolation policies.
-- -----------------------------------------------------------------------------

-- owners: read & update OWN record. Uses portal_user_id directly (not the
-- portal_enabled-gated helper) so the app can still detect the owner and show a
-- "portal disabled" message when the business has turned it off.
drop policy if exists "owners_portal_select" on owners;
create policy "owners_portal_select" on owners for select
  using (portal_user_id = auth.uid());

drop policy if exists "owners_portal_update" on owners;
create policy "owners_portal_update" on owners for update
  using      (portal_user_id = auth.uid())
  with check (portal_user_id = auth.uid());

-- pets: read own; update own only when pet edits are enabled.
drop policy if exists "pets_portal_select" on pets;
create policy "pets_portal_select" on pets for select
  using (owner_id = get_portal_owner_id());

drop policy if exists "pets_portal_update" on pets;
create policy "pets_portal_update" on pets for update
  using      (owner_id = get_portal_owner_id() and portal_can('pet_edits'))
  with check (owner_id = get_portal_owner_id() and portal_can('pet_edits'));

-- bookings: read own; create requests (always as an enquiry) when enabled.
drop policy if exists "bookings_portal_select" on bookings;
create policy "bookings_portal_select" on bookings for select
  using (owner_id = get_portal_owner_id());

drop policy if exists "bookings_portal_insert" on bookings;
create policy "bookings_portal_insert" on bookings for insert
  with check (
    owner_id = get_portal_owner_id()
    and portal_can('booking_requests')
    and status = 'enquiry'
  );

-- booking_pets: read own; attach own pets to own booking requests.
drop policy if exists "booking_pets_portal_select" on booking_pets;
create policy "booking_pets_portal_select" on booking_pets for select
  using (booking_id in (select id from bookings where owner_id = get_portal_owner_id()));

drop policy if exists "booking_pets_portal_insert" on booking_pets;
create policy "booking_pets_portal_insert" on booking_pets for insert
  with check (
    booking_id in (select id from bookings where owner_id = get_portal_owner_id())
    and pet_id  in (select id from pets     where owner_id = get_portal_owner_id())
    and portal_can('booking_requests')
  );

-- booking_space_assignments: read-only view of where own pets are staying.
drop policy if exists "bsa_portal_select" on booking_space_assignments;
create policy "bsa_portal_select" on booking_space_assignments for select
  using (booking_pet_id in (
    select bp.id from booking_pets bp
    join bookings b on b.id = bp.booking_id
    where b.owner_id = get_portal_owner_id()
  ));

-- vaccinations: read own pets'; upload (creates an unverified record) when docs enabled.
drop policy if exists "vaccinations_portal_select" on vaccinations;
create policy "vaccinations_portal_select" on vaccinations for select
  using (pet_id in (select id from pets where owner_id = get_portal_owner_id()));

drop policy if exists "vaccinations_portal_insert" on vaccinations;
create policy "vaccinations_portal_insert" on vaccinations for insert
  with check (
    pet_id in (select id from pets where owner_id = get_portal_owner_id())
    and portal_can('documents')
    and is_verified = false
  );

-- species: portal owners need names/icons to display their pets.
drop policy if exists "species_portal_select" on species;
create policy "species_portal_select" on species for select
  using (
    business_id is null
    or business_id in (select business_id from owners where portal_user_id = auth.uid())
  );

-- business / settings / theme: portal owners read their own business's row only.
drop policy if exists "businesses_portal_select" on businesses;
create policy "businesses_portal_select" on businesses for select
  using (id in (select business_id from owners where portal_user_id = auth.uid()));

drop policy if exists "business_settings_portal_select" on business_settings;
create policy "business_settings_portal_select" on business_settings for select
  using (business_id in (select business_id from owners where portal_user_id = auth.uid()));

drop policy if exists "business_theme_portal_select" on business_theme;
create policy "business_theme_portal_select" on business_theme for select
  using (business_id in (select business_id from owners where portal_user_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- 5. Invite RPCs
-- -----------------------------------------------------------------------------

-- Staff create / regenerate an invite for an owner (must share their business).
create or replace function create_owner_portal_invite(p_owner_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_biz   uuid;
  v_email text;
  v_token uuid;
begin
  select business_id, email into v_biz, v_email from owners where id = p_owner_id;
  if v_biz is null or v_biz <> get_current_business_id() then
    raise exception 'Owner not found in your business';
  end if;
  if v_email is null or length(trim(v_email)) = 0 then
    raise exception 'Add an email address to this owner before inviting them to the portal';
  end if;

  -- Replace any outstanding (unaccepted) invite for this owner.
  delete from owner_portal_invites where owner_id = p_owner_id and accepted_at is null;

  insert into owner_portal_invites (business_id, owner_id, email, invited_by)
  values (v_biz, p_owner_id, lower(v_email), auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

-- Public lookup for the accept page (bypasses RLS; invitee isn't linked yet).
create or replace function get_owner_portal_invite_by_token(p_token uuid)
returns table (business_name text, email text, owner_name text, expires_at timestamptz, is_valid boolean)
language sql security definer set search_path = public as $$
  select b.name,
         i.email,
         o.first_name || ' ' || o.last_name,
         i.expires_at,
         (i.accepted_at is null and i.expires_at > now()) as is_valid
  from owner_portal_invites i
  join businesses b on b.id = i.business_id
  join owners     o on o.id = i.owner_id
  where i.token = p_token;
$$;

-- Invitee accepts: validates token + that they're signed in with the invited
-- email, then links their auth user to the owner record.
create or replace function accept_owner_portal_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv   owner_portal_invites;
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then raise exception 'You must be signed in to accept this invite'; end if;

  select * into v_inv from owner_portal_invites where token = p_token;
  if v_inv.id is null            then raise exception 'Invite not found'; end if;
  if v_inv.accepted_at is not null then raise exception 'This invite has already been used'; end if;
  if v_inv.expires_at < now()    then raise exception 'This invite has expired'; end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is distinct from lower(v_inv.email) then
    raise exception 'This invite was sent to %. Please sign in with that email address.', v_inv.email;
  end if;

  update owners set portal_user_id = v_uid where id = v_inv.owner_id;
  update owner_portal_invites set accepted_at = now() where id = v_inv.id;

  return v_inv.owner_id;
end;
$$;

grant execute on function create_owner_portal_invite(uuid)       to authenticated;
grant execute on function get_owner_portal_invite_by_token(uuid) to authenticated;
grant execute on function accept_owner_portal_invite(uuid)       to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Storage — let linked portal owners upload documents to the public `pets`
--    bucket (read is already public). Additive, uniquely-named policy.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then
    drop policy if exists "portal_owner_document_upload" on storage.objects;
    create policy "portal_owner_document_upload" on storage.objects for insert to authenticated
      with check (
        bucket_id = 'pets'
        and get_portal_owner_id() is not null
        and portal_can('documents')
      );
  end if;
end $$;
