-- =============================================================================
-- PawBoard — Demo seed data
-- File: supabase/seed_demo.sql
--
-- A realistic mixed kennel + cattery, designed to show why the visual
-- booking board is useful: a busy "today" with arrivals, departures, pets
-- on-site, vaccination warnings, a full dog block (driving a waiting list),
-- pricing, and an operations checklist in progress.
--
-- HOW TO RUN
--   1. Make sure you have signed up / logged in at least once with the email
--      below, so a Supabase auth user exists.
--   2. Set v_owner_email (first line of the main DO block) to THAT email.
--   3. Supabase Dashboard → SQL Editor → paste this whole file → Run.
--
-- SAFE TO RE-RUN. It clears all existing tenant data first, then rebuilds.
-- System default species (Dog / Cat) are preserved. The whole script runs in
-- one transaction, so a failure rolls everything back.
--
-- Demo staff log-ins (optional): rebecca@pawboard.demo / tom@pawboard.demo /
-- priya@pawboard.demo — all with password  PawBoard!Demo123
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Ensure the pricing tables exist (they live outside the tracked migrations).
--    CREATE ... IF NOT EXISTS is a no-op when the table already exists, so this
--    never overwrites your real schema — it only helps on a fresh database.
-- -----------------------------------------------------------------------------

create table if not exists pricing_settings (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses(id) on delete cascade,
  calculation_method text not null default 'nightly',
  currency_code      text not null default 'GBP',
  created_at         timestamptz not null default now(),
  unique (business_id)
);

create table if not exists pricing_rates (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  area_id     uuid references accommodation_areas(id) on delete cascade,
  species_id  uuid references species(id) on delete cascade,
  pet_size    text,
  unit_price  numeric(10,2) not null,
  label       text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists pricing_sharing_rules (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  animal_number  integer not null,
  is_nth_onwards boolean not null default false,
  discount_type  text not null check (discount_type in ('fixed_price', 'percentage_off')),
  value          numeric(10,2) not null,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists booking_extras_catalog (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses(id) on delete cascade,
  name             text not null,
  description      text,
  unit_price       numeric(10,2) not null,
  charge_frequency text not null default 'once',
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists booking_line_items (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  description text not null,
  quantity    numeric(10,2) not null default 1,
  unit_price  numeric(10,2) not null,
  total_price numeric(10,2) not null,
  source      text not null default 'custom',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Make sure RLS + grants are in place for any tables created above.
alter table pricing_settings        enable row level security;
alter table pricing_rates           enable row level security;
alter table pricing_sharing_rules   enable row level security;
alter table booking_extras_catalog  enable row level security;
alter table booking_line_items      enable row level security;

do $$
begin
  -- pricing_settings
  drop policy if exists "demo tenant access" on pricing_settings;
  create policy "demo tenant access" on pricing_settings for all
    using (business_id = get_current_business_id())
    with check (business_id = get_current_business_id());
  -- pricing_rates
  drop policy if exists "demo tenant access" on pricing_rates;
  create policy "demo tenant access" on pricing_rates for all
    using (business_id = get_current_business_id())
    with check (business_id = get_current_business_id());
  -- pricing_sharing_rules
  drop policy if exists "demo tenant access" on pricing_sharing_rules;
  create policy "demo tenant access" on pricing_sharing_rules for all
    using (business_id = get_current_business_id())
    with check (business_id = get_current_business_id());
  -- booking_extras_catalog
  drop policy if exists "demo tenant access" on booking_extras_catalog;
  create policy "demo tenant access" on booking_extras_catalog for all
    using (business_id = get_current_business_id())
    with check (business_id = get_current_business_id());
  -- booking_line_items (scoped via parent booking)
  drop policy if exists "demo tenant access" on booking_line_items;
  create policy "demo tenant access" on booking_line_items for all
    using (booking_id in (select id from bookings where business_id = get_current_business_id()))
    with check (booking_id in (select id from bookings where business_id = get_current_business_id()));
end $$;

grant all on pricing_settings, pricing_rates, pricing_sharing_rules,
             booking_extras_catalog, booking_line_items to authenticated;

-- -----------------------------------------------------------------------------
-- 1. MAIN SEED
-- -----------------------------------------------------------------------------

do $$
declare
  -- ⬇⬇⬇ CHANGE THIS to the email you log in with ⬇⬇⬇
  v_owner_email text := 'tomjhole@msn.com';

  v_uid  uuid;                       -- your real auth user (business owner)
  v_biz  uuid := '30000000-0000-0000-0000-000000000001';
  c_dog  uuid := '00000000-0000-0000-0000-000000000001';  -- system species
  c_cat  uuid := '00000000-0000-0000-0000-000000000002';

  v_area_dog uuid := '40000000-0000-0000-0000-000000000001';
  v_area_cat uuid := '40000000-0000-0000-0000-000000000002';
  v_type_std uuid := '41000000-0000-0000-0000-000000000001';
  v_type_lrg uuid := '41000000-0000-0000-0000-000000000002';
  v_type_cab uuid := '41000000-0000-0000-0000-000000000003';

  v_mgr uuid := 'a0000000-0000-0000-0000-000000000001';
  v_st1 uuid := 'a0000000-0000-0000-0000-000000000002';
  v_st2 uuid := 'a0000000-0000-0000-0000-000000000003';

  v_kennel uuid[];                   -- 15 dog kennels, indexed 1..15
  v_cabin  uuid[];                   -- 10 cat cabins,  indexed 1..10
  v_today  date := current_date;
  v_id     uuid;
  v_sizes  pet_size[];
  i        int;
begin
  -- Resolve the logged-in user --------------------------------------------------
  select id into v_uid from auth.users where lower(email) = lower(v_owner_email) limit 1;
  if v_uid is null then
    raise exception
      'No Supabase auth user found for "%". Sign up / log in once with that email, or edit v_owner_email at the top of this script.',
      v_owner_email;
  end if;

  -- ===========================================================================
  -- 2. CLEAR DOWN  (child → parent so RESTRICT FKs never block us)
  -- ===========================================================================
  delete from audit_log;
  if to_regclass('public.payments') is not null then delete from payments; end if;
  if to_regclass('public.stay_journal_entries') is not null then delete from stay_journal_entries; end if;
  delete from daily_care_log;
  delete from daily_notes;
  delete from booking_line_items;
  delete from booking_space_assignments;
  delete from booking_pets;
  delete from bookings;
  delete from vaccinations;
  delete from pets;
  delete from owners;
  delete from pricing_rates;
  delete from pricing_sharing_rules;
  delete from pricing_settings;
  delete from booking_extras_catalog;
  delete from accommodation_space_species;
  delete from accommodation_area_species;
  delete from accommodation_spaces;
  delete from accommodation_space_types;
  delete from accommodation_areas;
  delete from staff_users;
  delete from business_theme;
  delete from business_settings;
  delete from businesses;

  -- Remove any previously-seeded demo staff auth users (cascades to identities)
  delete from auth.users where email like '%@pawboard.demo';

  -- ===========================================================================
  -- 3. BUSINESS, SETTINGS, THEME
  -- ===========================================================================
  insert into businesses (id, name, slug, email, phone, address_line1, city, postcode,
                          country, website, licence_number, subscription_plan, is_active)
  values (v_biz, 'Oakwood Boarding Kennels & Cattery', 'oakwood-boarding',
          'hello@oakwoodboarding.co.uk', '01865 555 0142', 'Oakwood Farm, Stanton Road',
          'Oxford', 'OX33 1HF', 'GB', 'https://oakwoodboarding.co.uk',
          'WODC/AB/2024/0091', 'professional', true);

  insert into business_settings (business_id, checkin_time, checkout_time,
                                 require_vaccination_proof, require_vet_details,
                                 allow_same_day_bookings, reminder_days_before)
  values (v_biz, '10:00', '11:00', true, true, false, 2);

  insert into business_theme (business_id, primary_colour, secondary_colour, accent_colour)
  values (v_biz, '#059669', '#0f172a', '#f59e0b');

  -- ===========================================================================
  -- 4. STAFF USERS  (owner = you; plus 3 demo staff with real auth logins)
  -- ===========================================================================
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', v_mgr, 'authenticated', 'authenticated',
     'rebecca@pawboard.demo', crypt('PawBoard!Demo123', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_st1, 'authenticated', 'authenticated',
     'tom@pawboard.demo', crypt('PawBoard!Demo123', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_st2, 'authenticated', 'authenticated',
     'priya@pawboard.demo', crypt('PawBoard!Demo123', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_mgr, 'rebecca@pawboard.demo',
     jsonb_build_object('sub', v_mgr::text, 'email', 'rebecca@pawboard.demo'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_st1, 'tom@pawboard.demo',
     jsonb_build_object('sub', v_st1::text, 'email', 'tom@pawboard.demo'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_st2, 'priya@pawboard.demo',
     jsonb_build_object('sub', v_st2::text, 'email', 'priya@pawboard.demo'), 'email', now(), now(), now())
  on conflict (provider_id, provider) do nothing;

  insert into staff_users (id, business_id, role, first_name, last_name, email, phone, is_active, last_seen_at)
  values
    (v_uid, v_biz, 'owner',   'Alex',    'Morgan',  v_owner_email,          '07700 900100', true, now()),
    (v_mgr, v_biz, 'manager', 'Rebecca', 'Shaw',    'rebecca@pawboard.demo','07700 900201', true, now() - interval '2 hours'),
    (v_st1, v_biz, 'staff',   'Tom',     'Fletcher','tom@pawboard.demo',    '07700 900202', true, now() - interval '20 minutes'),
    (v_st2, v_biz, 'read_only','Priya',  'Nair',    'priya@pawboard.demo',  '07700 900203', true, now() - interval '3 days');

  -- ===========================================================================
  -- 5. ACCOMMODATION — areas, types, spaces
  -- ===========================================================================
  insert into accommodation_areas (id, business_id, name, description, sort_order, created_by)
  values
    (v_area_dog, v_biz, 'Dog Block A', 'Heated indoor kennels with covered runs', 1, v_uid),
    (v_area_cat, v_biz, 'Main Cattery', 'Quiet multi-level cat cabins, away from the dogs', 2, v_uid);

  insert into accommodation_area_species (area_id, species_id, business_id)
  values
    (v_area_dog, c_dog, v_biz),
    (v_area_cat, c_cat, v_biz);

  insert into accommodation_space_types (id, business_id, name, description)
  values
    (v_type_std, v_biz, 'Standard Kennel', 'Single kennel with covered run'),
    (v_type_lrg, v_biz, 'Large Kennel',    'Extra-large kennel for big breeds or pairs'),
    (v_type_cab, v_biz, 'Cat Cabin',       'Multi-level cabin with view window');

  -- 15 dog kennels --------------------------------------------------------------
  for i in 1..15 loop
    v_id := ('55550000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    -- Kennels 11–13 are large (big breeds); 14–15 take any size; rest small/med
    if i between 11 and 13 then
      v_sizes := array['large','giant']::pet_size[];
    elsif i >= 14 then
      v_sizes := null;  -- any size welcome
    else
      v_sizes := array['toy','small','medium']::pet_size[];
    end if;

    insert into accommodation_spaces (id, business_id, area_id, space_type_id, name,
                                      max_pets, same_household_only, allow_mixed_species,
                                      allowed_pet_sizes, sort_order, created_by)
    values (v_id, v_biz, v_area_dog,
            case when i between 11 and 13 then v_type_lrg else v_type_std end,
            'Kennel ' || i,
            case when i in (1, 11) then 2 else 1 end,   -- a couple take same-household pairs
            true, false, v_sizes, i, v_uid);

    insert into accommodation_space_species (space_id, species_id, business_id)
    values (v_id, c_dog, v_biz);

    v_kennel[i] := v_id;
  end loop;

  -- 10 cat cabins ---------------------------------------------------------------
  for i in 1..10 loop
    v_id := ('56660000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    insert into accommodation_spaces (id, business_id, area_id, space_type_id, name,
                                      max_pets, same_household_only, allow_mixed_species,
                                      allowed_pet_sizes, sort_order, created_by)
    values (v_id, v_biz, v_area_cat, v_type_cab, 'Cabin ' || i,
            case when i in (1, 2, 3) then 2 else 1 end, -- family cabins for multi-cat households
            true, false, null, i, v_uid);

    insert into accommodation_space_species (space_id, species_id, business_id)
    values (v_id, c_cat, v_biz);

    v_cabin[i] := v_id;
  end loop;

  -- ===========================================================================
  -- 6. OWNERS  (incl. multi-pet households; Harry Lewis has no emergency contact
  --    on purpose, which makes his bookings show as "Details outstanding")
  -- ===========================================================================
  insert into owners (id, business_id, first_name, last_name, email, phone, phone_secondary,
                      address_line1, city, postcode,
                      emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                      emergency_contact_can_authorise_vet, notes, created_by)
  values
    ('11110000-0000-0000-0000-000000000001', v_biz, 'Sarah',     'Thompson', 'sarah.thompson@example.co.uk', '07700 900301', null,
     '14 Mill Lane', 'Abingdon', 'OX14 3JX', 'David Thompson', '07700 900401', 'Husband', true, 'Two house cats — like to share.', v_uid),
    ('11110000-0000-0000-0000-000000000002', v_biz, 'James',     'Patel',    'james.patel@example.co.uk', '07700 900302', '01235 555012',
     '7 Foxglove Close', 'Wantage', 'OX12 9PD', 'Anita Patel', '07700 900402', 'Wife', true, null, v_uid),
    ('11110000-0000-0000-0000-000000000003', v_biz, 'Emma',      'Wilson',   'emma.wilson@example.co.uk', '07700 900303', null,
     '22 Church Street', 'Oxford', 'OX4 1EN', 'Margaret Wilson', '07700 900403', 'Mother', true, null, v_uid),
    ('11110000-0000-0000-0000-000000000004', v_biz, 'Oliver',    'Brown',    'oliver.brown@example.co.uk', '07700 900304', null,
     '3 The Green', 'Witney', 'OX28 6JH', 'Claire Brown', '07700 900404', 'Wife', true, 'Bruno can be nervous — owner very particular.', v_uid),
    ('11110000-0000-0000-0000-000000000005', v_biz, 'Charlotte', 'Davies',   'charlotte.davies@example.co.uk', '07700 900305', null,
     '88 Banbury Road', 'Oxford', 'OX2 6JT', 'Tom Davies', '07700 900405', 'Brother', false, null, v_uid),
    ('11110000-0000-0000-0000-000000000006', v_biz, 'George',    'Evans',    'george.evans@example.co.uk', '07700 900306', null,
     '5 Orchard Way', 'Kidlington', 'OX5 2DT', 'Helen Evans', '07700 900406', 'Wife', true, 'Has a dog and a cat — books them together.', v_uid),
    ('11110000-0000-0000-0000-000000000007', v_biz, 'Sophie',    'Roberts',  'sophie.roberts@example.co.uk', '07700 900307', null,
     '41 Henley Avenue', 'Oxford', 'OX4 4DJ', 'Mark Roberts', '07700 900407', 'Husband', true, null, v_uid),
    ('11110000-0000-0000-0000-000000000008', v_biz, 'Harry',     'Lewis',    'harry.lewis@example.co.uk', '07700 900308', null,
     '12 Stable Mews', 'Bicester', 'OX26 2AB', null, null, null, false, 'NEW CUSTOMER — emergency contact still to be collected.', v_uid),
    ('11110000-0000-0000-0000-000000000009', v_biz, 'Amelia',    'Walker',   'amelia.walker@example.co.uk', '07700 900309', null,
     '9 Riverside', 'Eynsham', 'OX29 4LH', 'Paul Walker', '07700 900409', 'Husband', true, null, v_uid),
    ('11110000-0000-0000-0000-000000000010', v_biz, 'Jack',      'Hughes',   'jack.hughes@example.co.uk', '07700 900310', null,
     '64 Marlborough Road', 'Oxford', 'OX1 4LW', 'Lucy Hughes', '07700 900410', 'Wife', true, null, v_uid),
    ('11110000-0000-0000-0000-000000000011', v_biz, 'Grace',     'Hall',     'grace.hall@example.co.uk', '07700 900311', null,
     '2 Larch Close', 'Carterton', 'OX18 3RT', 'Ben Hall', '07700 900411', 'Husband', true, null, v_uid),
    ('11110000-0000-0000-0000-000000000012', v_biz, 'Lily',      'Green',    'lily.green@example.co.uk', '07700 900312', null,
     '30 Cumnor Hill', 'Oxford', 'OX2 9HD', 'Sam Green', '07700 900412', 'Partner', true, null, v_uid);

  -- ===========================================================================
  -- 7. PETS  (dogs are sized; cats have NULL size)
  -- ===========================================================================
  insert into pets (id, business_id, owner_id, species_id, name, breed, date_of_birth, sex,
                    is_neutered, size, feeds_per_day, microchip_number, can_mix_with_others,
                    colour_markings, behaviour_notes, medical_notes, feeding_instructions,
                    flea_treatment_date, worming_treatment_date,
                    vet_practice_name, vet_phone, created_by)
  values
    -- Thompson cats (share Cabin 1)
    ('22220000-0000-0000-0000-000000000001', v_biz, '11110000-0000-0000-0000-000000000001', c_cat, 'Milo',  'Domestic Shorthair', v_today - interval '4 years',  'male',   true,  null, 2, '981000111100001', true, 'Black & white', null, null, 'Wet food morning, dry biscuits evening.', v_today - 30, v_today - 30, 'Abingdon Vets4Pets', '01235 555201', v_uid),
    ('22220000-0000-0000-0000-000000000002', v_biz, '11110000-0000-0000-0000-000000000001', c_cat, 'Bella', 'Domestic Shorthair', v_today - interval '3 years',  'female', true,  null, 2, '981000111100002', true, 'Tabby', null, null, 'Same as Milo.', v_today - 30, v_today - 30, 'Abingdon Vets4Pets', '01235 555201', v_uid),
    -- Patel dogs
    ('22220000-0000-0000-0000-000000000003', v_biz, '11110000-0000-0000-0000-000000000002', c_dog, 'Rocky', 'Labrador Retriever', v_today - interval '5 years',  'male',   true,  'large',  2, '981000111100003', true, 'Golden', null, 'On joint supplement.', '300g twice daily.', v_today - 20, v_today - 45, 'Wantage Veterinary Centre', '01235 555202', v_uid),
    ('22220000-0000-0000-0000-000000000004', v_biz, '11110000-0000-0000-0000-000000000002', c_dog, 'Daisy', 'Cocker Spaniel',     v_today - interval '2 years',  'female', true,  'medium', 2, '981000111100004', true, 'Liver roan', null, null, '200g twice daily.', v_today - 20, v_today - 45, 'Wantage Veterinary Centre', '01235 555202', v_uid),
    -- Wilson
    ('22220000-0000-0000-0000-000000000005', v_biz, '11110000-0000-0000-0000-000000000003', c_dog, 'Max',   'Border Collie',      v_today - interval '6 years',  'male',   true,  'medium', 2, '981000111100005', true, 'Black & white', 'High energy — needs plenty of exercise.', null, null, v_today - 15, v_today - 60, 'St Clements Vets', '01865 555203', v_uid),
    -- Brown — giant, does not mix
    ('22220000-0000-0000-0000-000000000006', v_biz, '11110000-0000-0000-0000-000000000004', c_dog, 'Bruno', 'Newfoundland',       v_today - interval '4 years',  'male',   false, 'giant',  3, '981000111100006', false, 'Black', 'Reactive to other dogs — must be walked alone and kept in an end kennel.', 'Hip dysplasia — short walks only.', 'Large breed food, 3 meals.', v_today - 25, v_today - 25, 'Witney Vets', '01993 555204', v_uid),
    -- Davies cat
    ('22220000-0000-0000-0000-000000000007', v_biz, '11110000-0000-0000-0000-000000000005', c_cat, 'Smudge','Domestic Longhair',  v_today - interval '7 years',  'female', true,  null, 2, '981000111100007', true, 'Grey', 'Shy — likes a covered area.', null, null, v_today - 40, v_today - 40, 'Summertown Vets', '01865 555205', v_uid),
    -- Evans — dog + cat household
    ('22220000-0000-0000-0000-000000000008', v_biz, '11110000-0000-0000-0000-000000000006', c_dog, 'Poppy', 'Cavapoo',            v_today - interval '1 year',   'female', false, 'small',  2, '981000111100008', true, 'Apricot', null, null, null, v_today - 10, v_today - 35, 'Kidlington Vets', '01865 555206', v_uid),
    ('22220000-0000-0000-0000-000000000009', v_biz, '11110000-0000-0000-0000-000000000006', c_cat, 'Tigger','Ginger Tom',         v_today - interval '5 years',  'male',   true,  null, 2, '981000111100009', true, 'Ginger', null, null, null, v_today - 10, v_today - 35, 'Kidlington Vets', '01865 555206', v_uid),
    -- Roberts
    ('22220000-0000-0000-0000-000000000010', v_biz, '11110000-0000-0000-0000-000000000007', c_dog, 'Luna',  'German Shepherd',    v_today - interval '3 years',  'female', true,  'large',  2, '981000111100010', true, 'Black & tan', null, null, null, v_today - 18, v_today - 50, 'Cowley Road Vets', '01865 555207', v_uid),
    -- Lewis cat (rejected vaccination doc)
    ('22220000-0000-0000-0000-000000000011', v_biz, '11110000-0000-0000-0000-000000000008', c_cat, 'Oscar', 'British Shorthair',  v_today - interval '2 years',  'male',   true,  null, 2, '981000111100011', true, 'Blue', null, null, null, v_today - 12, v_today - 12, 'Bicester Vets', '01869 555208', v_uid),
    -- Walker dog (EXPIRED vaccination)
    ('22220000-0000-0000-0000-000000000012', v_biz, '11110000-0000-0000-0000-000000000009', c_dog, 'Charlie','Beagle',            v_today - interval '4 years',  'male',   true,  'medium', 2, '981000111100012', true, 'Tricolour', null, null, null, v_today - 22, v_today - 70, 'Eynsham Vets', '01865 555209', v_uid),
    -- Hughes dog (UNVERIFIED vaccination pending)
    ('22220000-0000-0000-0000-000000000013', v_biz, '11110000-0000-0000-0000-000000000010', c_dog, 'Bailey','Staffordshire Bull Terrier', v_today - interval '3 years', 'male', true, 'small', 2, '981000111100013', true, 'Brindle', null, null, null, v_today - 8, v_today - 30, 'Oxford City Vets', '01865 555210', v_uid),
    -- Hall cat (EXPIRING SOON)
    ('22220000-0000-0000-0000-000000000014', v_biz, '11110000-0000-0000-0000-000000000011', c_cat, 'Cleo',  'Siamese',            v_today - interval '6 years',  'female', true,  null, 2, '981000111100014', true, 'Seal point', null, 'Sensitive stomach — sensitive-formula food only.', 'Sensitive-stomach food, small portions.', v_today - 14, v_today - 14, 'Carterton Vets', '01993 555211', v_uid),
    -- Green dogs
    ('22220000-0000-0000-0000-000000000015', v_biz, '11110000-0000-0000-0000-000000000012', c_dog, 'Teddy', 'Pomeranian',         v_today - interval '2 years',  'male',   true,  'toy',    2, '981000111100015', true, 'Cream', null, null, null, v_today - 16, v_today - 40, 'Cumnor Vets', '01865 555212', v_uid),
    ('22220000-0000-0000-0000-000000000016', v_biz, '11110000-0000-0000-0000-000000000012', c_dog, 'Coco',  'Miniature Dachshund',v_today - interval '1 year',   'female', false, 'small',  2, '981000111100016', true, 'Black & tan', null, null, null, v_today - 16, v_today - 40, 'Cumnor Vets', '01865 555212', v_uid);

  -- ===========================================================================
  -- 8. VACCINATIONS  (verified in-date, expired, expiring-soon, unverified, rejected)
  -- ===========================================================================
  insert into vaccinations (pet_id, business_id, vaccination_type, administered_date, expiry_date,
                            is_verified, verified_by, verified_at, is_rejected, rejection_reason, created_by)
  values
    -- in-date, verified
    ('22220000-0000-0000-0000-000000000001', v_biz, 'Cat Flu & Enteritis (FVRCP)', v_today - 300, v_today + 65,  true, v_uid, now() - interval '20 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000002', v_biz, 'Cat Flu & Enteritis (FVRCP)', v_today - 300, v_today + 65,  true, v_uid, now() - interval '20 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000003', v_biz, 'DHP (Distemper/Hepatitis/Parvo)', v_today - 200, v_today + 165, true, v_uid, now() - interval '40 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000003', v_biz, 'Kennel Cough (Bordetella)',   v_today - 40,  v_today + 325, true, v_uid, now() - interval '38 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000004', v_biz, 'DHP (Distemper/Hepatitis/Parvo)', v_today - 210, v_today + 150, true, v_uid, now() - interval '40 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000005', v_biz, 'DHP (Distemper/Hepatitis/Parvo)', v_today - 180, v_today + 185, true, v_uid, now() - interval '30 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000006', v_biz, 'DHP (Distemper/Hepatitis/Parvo)', v_today - 150, v_today + 215, true, v_uid, now() - interval '25 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000006', v_biz, 'Leptospirosis',               v_today - 150, v_today + 215, true, v_uid, now() - interval '25 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000007', v_biz, 'Cat Flu & Enteritis (FVRCP)', v_today - 120, v_today + 245, true, v_uid, now() - interval '20 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000008', v_biz, 'DHP (Distemper/Hepatitis/Parvo)', v_today - 90,  v_today + 275, true, v_uid, now() - interval '10 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000009', v_biz, 'Cat Flu & Enteritis (FVRCP)', v_today - 130, v_today + 235, true, v_uid, now() - interval '20 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000010', v_biz, 'DHP (Distemper/Hepatitis/Parvo)', v_today - 100, v_today + 265, true, v_uid, now() - interval '15 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000015', v_biz, 'DHP (Distemper/Hepatitis/Parvo)', v_today - 60,  v_today + 305, true, v_uid, now() - interval '10 days', false, null, v_uid),
    ('22220000-0000-0000-0000-000000000016', v_biz, 'DHP (Distemper/Hepatitis/Parvo)', v_today - 60,  v_today + 305, true, v_uid, now() - interval '10 days', false, null, v_uid),
    -- EXPIRED — Charlie (Walker)
    ('22220000-0000-0000-0000-000000000012', v_biz, 'DHP (Distemper/Hepatitis/Parvo)', v_today - 380, v_today - 10, true, v_uid, now() - interval '300 days', false, null, v_uid),
    -- EXPIRING SOON — Cleo (Hall)
    ('22220000-0000-0000-0000-000000000014', v_biz, 'Cat Flu & Enteritis (FVRCP)', v_today - 350, v_today + 18, true, v_uid, now() - interval '40 days', false, null, v_uid),
    -- UNVERIFIED / pending — Bailey (Hughes)
    ('22220000-0000-0000-0000-000000000013', v_biz, 'Kennel Cough (Bordetella)',   v_today - 5,   v_today + 360, false, null, null, false, null, v_uid),
    -- REJECTED — Oscar (Lewis)
    ('22220000-0000-0000-0000-000000000011', v_biz, 'Cat Flu & Enteritis (FVRCP)', v_today - 20,  v_today + 345, false, null, null, true, 'Certificate photo was blurry — please re-upload a clear copy.', v_uid);

  -- ===========================================================================
  -- 9. BOOKINGS  (dates relative to today; rich "today" + several weeks ahead)
  --    booking_pets and space assignments follow.
  -- ===========================================================================
  insert into bookings (id, business_id, owner_id, status, start_date, end_date, source, notes,
                        checked_in_at, checked_in_by, checked_out_at, checked_out_by,
                        deposit_amount, deposit_paid, total_amount, balance_paid, created_by, created_at)
  values
    -- B1  Thompson — 2 cats ON-SITE
    ('33330000-0000-0000-0000-000000000001', v_biz, '11110000-0000-0000-0000-000000000001', 'checked_in', v_today - 3, v_today + 4, 'phone', 'Both cats share a family cabin.',
      (v_today - 3) + time '10:15', v_uid, null, null, 30.00, true, 126.00, false, v_uid, now() - interval '21 days'),
    -- B2  Patel — 2 dogs ON-SITE, due out tomorrow
    ('33330000-0000-0000-0000-000000000002', v_biz, '11110000-0000-0000-0000-000000000002', 'checked_in', v_today - 2, v_today + 1, 'email', null,
      (v_today - 2) + time '09:40', v_st1, null, null, 40.00, true, 165.00, false, v_uid, now() - interval '14 days'),
    -- B3  Wilson — Max DUE OUT TODAY
    ('33330000-0000-0000-0000-000000000003', v_biz, '11110000-0000-0000-0000-000000000003', 'due_out', v_today - 5, v_today, 'phone', 'Collection expected late morning.',
      (v_today - 5) + time '10:05', v_uid, null, null, 25.00, true, 125.00, false, v_uid, now() - interval '25 days'),
    -- B4  Brown — Bruno ON-SITE (giant, end kennel, walked alone)
    ('33330000-0000-0000-0000-000000000004', v_biz, '11110000-0000-0000-0000-000000000004', 'checked_in', v_today - 1, v_today + 6, 'phone', 'Walk alone — reactive. End kennel only.',
      (v_today - 1) + time '11:20', v_mgr, null, null, 50.00, true, 210.00, false, v_uid, now() - interval '30 days'),
    -- B5  Davies — Smudge DUE OUT TODAY
    ('33330000-0000-0000-0000-000000000005', v_biz, '11110000-0000-0000-0000-000000000005', 'due_out', v_today - 4, v_today, 'walk_in', null,
      (v_today - 4) + time '10:30', v_st1, null, null, 18.00, true, 72.00, false, v_uid, now() - interval '18 days'),
    -- B6  Evans — dog + cat ARRIVING TODAY
    ('33330000-0000-0000-0000-000000000006', v_biz, '11110000-0000-0000-0000-000000000006', 'ready', v_today, v_today + 7, 'portal', 'Dog and cat — separate areas.',
      null, null, null, null, 40.00, true, 196.00, false, v_uid, now() - interval '9 days'),
    -- B7  Roberts — Luna ARRIVING TOMORROW
    ('33330000-0000-0000-0000-000000000007', v_biz, '11110000-0000-0000-0000-000000000007', 'confirmed', v_today + 1, v_today + 5, 'phone', null,
      null, null, null, null, 30.00, true, 120.00, false, v_uid, now() - interval '6 days'),
    -- B8  Walker — Charlie (EXPIRED vaccination) future
    ('33330000-0000-0000-0000-000000000008', v_biz, '11110000-0000-0000-0000-000000000009', 'confirmed', v_today + 2, v_today + 9, 'phone', 'Chase vaccination certificate before arrival.',
      null, null, null, null, 25.00, false, 175.00, false, v_uid, now() - interval '4 days'),
    -- B9  Hughes — Bailey (UNVERIFIED vaccination) ARRIVING TODAY
    ('33330000-0000-0000-0000-000000000009', v_biz, '11110000-0000-0000-0000-000000000010', 'ready', v_today, v_today + 3, 'email', 'Vaccination proof uploaded — needs checking at check-in.',
      null, null, null, null, 20.00, true, 75.00, false, v_uid, now() - interval '5 days'),
    -- B10 Hall — Cleo (EXPIRING SOON) ON-SITE
    ('33330000-0000-0000-0000-000000000010', v_biz, '11110000-0000-0000-0000-000000000011', 'checked_in', v_today - 2, v_today + 2, 'phone', null,
      (v_today - 2) + time '10:50', v_st1, null, null, 18.00, true, 72.00, false, v_uid, now() - interval '12 days'),
    -- B11 Lewis — Oscar (owner missing emergency contact ⇒ shows "Details outstanding")
    ('33330000-0000-0000-0000-000000000011', v_biz, '11110000-0000-0000-0000-000000000008', 'confirmed', v_today + 1, v_today + 6, 'walk_in', 'New customer — collect emergency contact + check vaccination.',
      null, null, null, null, 18.00, false, 90.00, false, v_uid, now() - interval '2 days'),
    -- B12 Green — Teddy ENQUIRY (no space yet)
    ('33330000-0000-0000-0000-000000000012', v_biz, '11110000-0000-0000-0000-000000000012', 'enquiry', v_today + 10, v_today + 14, 'email', 'Asked about availability over the bank holiday.',
      null, null, null, null, null, false, null, false, v_uid, now() - interval '1 day'),
    -- B13 Green — Coco WAITING LIST (dog block full that week)
    ('33330000-0000-0000-0000-000000000013', v_biz, '11110000-0000-0000-0000-000000000012', 'waiting_list', v_today + 2, v_today + 9, 'phone', 'Wants the same week as Charlie — added to the waiting list in case a kennel frees up.',
      null, null, null, null, null, false, null, false, v_uid, now() - interval '1 day'),
    -- B14 Wilson — CANCELLED
    ('33330000-0000-0000-0000-000000000014', v_biz, '11110000-0000-0000-0000-000000000003', 'cancelled', v_today + 20, v_today + 25, 'phone', 'Cancelled — holiday plans changed.',
      null, null, null, null, 25.00, true, null, false, v_uid, now() - interval '7 days'),
    -- B15 Patel — PAST completed stay (history + audit)
    ('33330000-0000-0000-0000-000000000015', v_biz, '11110000-0000-0000-0000-000000000002', 'checked_out', v_today - 30, v_today - 23, 'phone', null,
      (v_today - 30) + time '10:00', v_uid, (v_today - 23) + time '10:40', v_mgr, 25.00, true, 175.00, true, v_uid, now() - interval '45 days'),
    -- B16 Thompson — future confirmed
    ('33330000-0000-0000-0000-000000000016', v_biz, '11110000-0000-0000-0000-000000000001', 'confirmed', v_today + 12, v_today + 18, 'phone', null,
      null, null, null, null, 30.00, true, 162.00, false, v_uid, now() - interval '3 days'),
    -- B17 Brown — future confirmed
    ('33330000-0000-0000-0000-000000000017', v_biz, '11110000-0000-0000-0000-000000000004', 'confirmed', v_today + 20, v_today + 27, 'phone', null,
      null, null, null, null, 50.00, false, 245.00, false, v_uid, now() - interval '2 days'),
    -- B18 Davies — fills cattery next week
    ('33330000-0000-0000-0000-000000000018', v_biz, '11110000-0000-0000-0000-000000000005', 'confirmed', v_today + 8, v_today + 12, 'walk_in', null,
      null, null, null, null, 18.00, true, 72.00, false, v_uid, now() - interval '3 days'),
    -- B19 Walker — fills dog block later
    ('33330000-0000-0000-0000-000000000019', v_biz, '11110000-0000-0000-0000-000000000009', 'confirmed', v_today + 15, v_today + 20, 'phone', null,
      null, null, null, null, 25.00, false, 125.00, false, v_uid, now() - interval '1 day'),
    -- B20 Wilson — Max rebooked, fills dog block during the busy week
    ('33330000-0000-0000-0000-000000000020', v_biz, '11110000-0000-0000-0000-000000000003', 'confirmed', v_today + 2, v_today + 9, 'phone', null,
      null, null, null, null, 25.00, true, 175.00, false, v_uid, now() - interval '2 days');

  -- ---------------------------------------------------------------------------
  -- 9a. booking_pets  (fixed IDs so we can attach space assignments & care logs)
  -- ---------------------------------------------------------------------------
  insert into booking_pets (id, booking_id, pet_id, business_id, feeds_per_day, feeding_instructions, notes)
  values
    ('44440000-0000-0000-0000-000000000001', '33330000-0000-0000-0000-000000000001', '22220000-0000-0000-0000-000000000001', v_biz, 2, 'Wet AM, dry PM.', null),
    ('44440000-0000-0000-0000-000000000002', '33330000-0000-0000-0000-000000000001', '22220000-0000-0000-0000-000000000002', v_biz, 2, 'Same as Milo.', null),
    ('44440000-0000-0000-0000-000000000003', '33330000-0000-0000-0000-000000000002', '22220000-0000-0000-0000-000000000003', v_biz, 2, '300g twice daily.', 'On joint supplement — owner supplied.'),
    ('44440000-0000-0000-0000-000000000004', '33330000-0000-0000-0000-000000000002', '22220000-0000-0000-0000-000000000004', v_biz, 2, '200g twice daily.', null),
    ('44440000-0000-0000-0000-000000000005', '33330000-0000-0000-0000-000000000003', '22220000-0000-0000-0000-000000000005', v_biz, 2, null, 'Needs lots of exercise.'),
    ('44440000-0000-0000-0000-000000000006', '33330000-0000-0000-0000-000000000004', '22220000-0000-0000-0000-000000000006', v_biz, 3, 'Large breed food, 3 meals.', 'WALK ALONE. End kennel.'),
    ('44440000-0000-0000-0000-000000000007', '33330000-0000-0000-0000-000000000005', '22220000-0000-0000-0000-000000000007', v_biz, 2, null, 'Shy — give a covered area.'),
    ('44440000-0000-0000-0000-000000000008', '33330000-0000-0000-0000-000000000006', '22220000-0000-0000-0000-000000000008', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000009', '33330000-0000-0000-0000-000000000006', '22220000-0000-0000-0000-000000000009', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000010', '33330000-0000-0000-0000-000000000007', '22220000-0000-0000-0000-000000000010', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000011', '33330000-0000-0000-0000-000000000008', '22220000-0000-0000-0000-000000000012', v_biz, 2, null, 'CHECK vaccination — was expired.'),
    ('44440000-0000-0000-0000-000000000012', '33330000-0000-0000-0000-000000000009', '22220000-0000-0000-0000-000000000013', v_biz, 2, null, 'Verify uploaded vaccination at check-in.'),
    ('44440000-0000-0000-0000-000000000013', '33330000-0000-0000-0000-000000000010', '22220000-0000-0000-0000-000000000014', v_biz, 2, 'Sensitive-stomach food only.', null),
    ('44440000-0000-0000-0000-000000000014', '33330000-0000-0000-0000-000000000011', '22220000-0000-0000-0000-000000000011', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000015', '33330000-0000-0000-0000-000000000012', '22220000-0000-0000-0000-000000000015', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000016', '33330000-0000-0000-0000-000000000013', '22220000-0000-0000-0000-000000000016', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000017', '33330000-0000-0000-0000-000000000015', '22220000-0000-0000-0000-000000000003', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000018', '33330000-0000-0000-0000-000000000016', '22220000-0000-0000-0000-000000000001', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000019', '33330000-0000-0000-0000-000000000016', '22220000-0000-0000-0000-000000000002', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000020', '33330000-0000-0000-0000-000000000017', '22220000-0000-0000-0000-000000000006', v_biz, 3, null, null),
    ('44440000-0000-0000-0000-000000000021', '33330000-0000-0000-0000-000000000018', '22220000-0000-0000-0000-000000000007', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000022', '33330000-0000-0000-0000-000000000019', '22220000-0000-0000-0000-000000000012', v_biz, 2, null, null),
    ('44440000-0000-0000-0000-000000000023', '33330000-0000-0000-0000-000000000020', '22220000-0000-0000-0000-000000000005', v_biz, 2, null, null);

  -- ---------------------------------------------------------------------------
  -- 9b. Space assignments  (enquiry / waiting-list / cancelled have none)
  -- ---------------------------------------------------------------------------
  insert into booking_space_assignments (booking_pet_id, space_id, business_id, start_date, end_date, assigned_by)
  values
    -- B1 Thompson cats share Cabin 1
    ('44440000-0000-0000-0000-000000000001', v_cabin[1],  v_biz, v_today - 3, v_today + 4, v_uid),
    ('44440000-0000-0000-0000-000000000002', v_cabin[1],  v_biz, v_today - 3, v_today + 4, v_uid),
    -- B2 Patel dogs (Rocky is large → large kennel 11; Daisy medium → kennel 3)
    ('44440000-0000-0000-0000-000000000003', v_kennel[11],v_biz, v_today - 2, v_today + 1, v_uid),
    ('44440000-0000-0000-0000-000000000004', v_kennel[3], v_biz, v_today - 2, v_today + 1, v_uid),
    -- B3 Wilson Max
    ('44440000-0000-0000-0000-000000000005', v_kennel[4], v_biz, v_today - 5, v_today,     v_uid),
    -- B4 Brown Bruno — large end kennel
    ('44440000-0000-0000-0000-000000000006', v_kennel[13],v_biz, v_today - 1, v_today + 6, v_mgr),
    -- B5 Davies Smudge
    ('44440000-0000-0000-0000-000000000007', v_cabin[4],  v_biz, v_today - 4, v_today,     v_uid),
    -- B6 Evans dog + cat
    ('44440000-0000-0000-0000-000000000008', v_kennel[5], v_biz, v_today,     v_today + 7, v_uid),
    ('44440000-0000-0000-0000-000000000009', v_cabin[5],  v_biz, v_today,     v_today + 7, v_uid),
    -- B7 Roberts Luna (large → large kennel 12)
    ('44440000-0000-0000-0000-000000000010', v_kennel[12],v_biz, v_today + 1, v_today + 5, v_uid),
    -- B8 Walker Charlie
    ('44440000-0000-0000-0000-000000000011', v_kennel[7], v_biz, v_today + 2, v_today + 9, v_uid),
    -- B9 Hughes Bailey
    ('44440000-0000-0000-0000-000000000012', v_kennel[8], v_biz, v_today,     v_today + 3, v_uid),
    -- B10 Hall Cleo
    ('44440000-0000-0000-0000-000000000013', v_cabin[6],  v_biz, v_today - 2, v_today + 2, v_uid),
    -- B11 Lewis Oscar
    ('44440000-0000-0000-0000-000000000014', v_cabin[7],  v_biz, v_today + 1, v_today + 6, v_uid),
    -- B15 Patel Rocky (past stay)
    ('44440000-0000-0000-0000-000000000017', v_kennel[11],v_biz, v_today - 30, v_today - 23, v_uid),
    -- B16 Thompson cats future
    ('44440000-0000-0000-0000-000000000018', v_cabin[1],  v_biz, v_today + 12, v_today + 18, v_uid),
    ('44440000-0000-0000-0000-000000000019', v_cabin[2],  v_biz, v_today + 12, v_today + 18, v_uid),
    -- B17 Brown Bruno future
    ('44440000-0000-0000-0000-000000000020', v_kennel[13],v_biz, v_today + 20, v_today + 27, v_uid),
    -- B18 Davies Smudge future
    ('44440000-0000-0000-0000-000000000021', v_cabin[4],  v_biz, v_today + 8,  v_today + 12, v_uid),
    -- B19 Walker Charlie future
    ('44440000-0000-0000-0000-000000000022', v_kennel[7], v_biz, v_today + 15, v_today + 20, v_uid),
    -- B20 Wilson Max — busy week
    ('44440000-0000-0000-0000-000000000023', v_kennel[9], v_biz, v_today + 2,  v_today + 9, v_uid);

  -- ===========================================================================
  -- 10. PRICING  (settings, rate card, sharing discount, extras)
  -- ===========================================================================
  insert into pricing_settings (business_id, calculation_method, currency_code)
  values (v_biz, 'nightly', 'GBP');

  insert into pricing_rates (business_id, area_id, species_id, pet_size, unit_price, label, sort_order, is_active)
  values
    (v_biz, v_area_dog, c_dog, 'small',  22.00, 'Small dog',     1, true),
    (v_biz, v_area_dog, c_dog, 'medium', 25.00, 'Medium dog',    2, true),
    (v_biz, v_area_dog, c_dog, 'large',  30.00, 'Large dog',     3, true),
    (v_biz, v_area_dog, c_dog, 'giant',  35.00, 'Giant dog',     4, true),
    (v_biz, v_area_dog, c_dog, null,     25.00, 'Dog (standard)',5, true),
    (v_biz, v_area_cat, c_cat, null,     18.00, 'Cat cabin',     6, true);

  insert into pricing_sharing_rules (business_id, animal_number, is_nth_onwards, discount_type, value, sort_order)
  values
    (v_biz, 2, true, 'percentage_off', 50.00, 1);   -- 2nd animal onwards: half price when sharing

  insert into booking_extras_catalog (business_id, name, description, unit_price, charge_frequency, sort_order, is_active)
  values
    (v_biz, 'Bath & groom',            'Full bath, brush and nail trim before collection', 25.00, 'once',    1, true),
    (v_biz, 'Extra daily walk',        'An additional one-to-one walk each day',           6.00,  'nightly', 2, true),
    (v_biz, 'Medication administration','Giving owner-supplied medication',                3.00,  'nightly', 3, true),
    (v_biz, 'Collection & drop-off',   'Local pick-up and return',                         20.00, 'once',    4, true);

  -- A few worked-out invoices so totals show on the board / booking detail
  insert into booking_line_items (booking_id, description, quantity, unit_price, total_price, source, sort_order)
  values
    -- B1 Thompson: 2 cats sharing, 7 nights, 2nd cat half price + a groom
    ('33330000-0000-0000-0000-000000000001', 'Milo — Cat cabin',  7, 18.00, 126.00, 'rate',  0),
    ('33330000-0000-0000-0000-000000000001', 'Bella — Cat cabin (sharing)', 7, 9.00, 63.00, 'rate', 1),
    ('33330000-0000-0000-0000-000000000001', 'Bath & groom', 1, 25.00, 25.00, 'extra', 2),
    -- B2 Patel: Rocky (large) + Daisy (medium), 3 nights
    ('33330000-0000-0000-0000-000000000002', 'Rocky — Large dog', 3, 30.00, 90.00, 'rate', 0),
    ('33330000-0000-0000-0000-000000000002', 'Daisy — Medium dog',3, 25.00, 75.00, 'rate', 1),
    -- B4 Brown: Bruno giant, 7 nights + meds
    ('33330000-0000-0000-0000-000000000004', 'Bruno — Giant dog', 7, 35.00, 245.00, 'rate', 0),
    -- B15 Patel past: Rocky 7 nights
    ('33330000-0000-0000-0000-000000000015', 'Rocky — Large dog', 7, 25.00, 175.00, 'rate', 0);

  -- ===========================================================================
  -- 10b. PAYMENTS — back the deposit/balance flags with real ledger entries so
  --      the booking's Payments panel matches the bookings-list status. Skipped
  --      if the payments table hasn't been created yet (run the payments migration).
  -- ===========================================================================
  if to_regclass('public.payments') is not null then
    -- a deposit payment for every booking flagged deposit_paid
    insert into payments (business_id, booking_id, amount, method, kind, status, paid_at, created_by)
    select v_biz, id, coalesce(deposit_amount, 0), 'cash', 'deposit', 'paid', created_at, v_uid
    from bookings
    where business_id = v_biz and deposit_paid and coalesce(deposit_amount, 0) > 0;

    -- the remaining balance for fully-settled (checked-out) bookings
    insert into payments (business_id, booking_id, amount, method, kind, status, paid_at, created_by)
    select v_biz, id, coalesce(total_amount, 0) - coalesce(deposit_amount, 0), 'bank_transfer', 'balance', 'paid',
           coalesce(checked_out_at, created_at), v_uid
    from bookings
    where business_id = v_biz and balance_paid and (coalesce(total_amount, 0) - coalesce(deposit_amount, 0)) > 0;
  end if;

  -- ===========================================================================
  -- 11. OPERATIONS — daily handover note + today's care checklist (in progress)
  -- ===========================================================================
  insert into daily_notes (business_id, log_date, note_text)
  values (v_biz, v_today,
    E'Busy day: 2 collections this morning (Max, Smudge) and 3 arrivals (Evans dog+cat, Bailey).\n• Bailey (Hughes) — CHECK vaccination proof at check-in.\n• Bruno (Brown) — walk alone, do not put near other dogs.\n• Cleo (Hall) — sensitive stomach, her own food only.');

  -- Today's care for pets currently on-site (some done, some still to do —
  -- so the operations board shows real progress).
  insert into daily_care_log (business_id, booking_pet_id, log_date, care_type, completed_at, completed_by)
  values
    -- Thompson cats — morning feed done
    (v_biz, '44440000-0000-0000-0000-000000000001', v_today, 'feed_1', now() - interval '3 hours', v_st1),
    (v_biz, '44440000-0000-0000-0000-000000000002', v_today, 'feed_1', now() - interval '3 hours', v_st1),
    -- Patel dogs — fed + walked
    (v_biz, '44440000-0000-0000-0000-000000000003', v_today, 'feed_1',   now() - interval '3 hours', v_st1),
    (v_biz, '44440000-0000-0000-0000-000000000003', v_today, 'exercise', now() - interval '2 hours', v_st1),
    (v_biz, '44440000-0000-0000-0000-000000000004', v_today, 'feed_1',   now() - interval '3 hours', v_st1),
    (v_biz, '44440000-0000-0000-0000-000000000004', v_today, 'exercise', now() - interval '2 hours', v_st1),
    -- Bruno — fed (walk still pending, walked alone later)
    (v_biz, '44440000-0000-0000-0000-000000000006', v_today, 'feed_1', now() - interval '3 hours', v_mgr),
    -- Cleo — morning feed done
    (v_biz, '44440000-0000-0000-0000-000000000013', v_today, 'feed_1', now() - interval '3 hours', v_st1);

  -- ===========================================================================
  -- 12. AUDIT LOG — a few entries so the timeline shows on detail pages
  -- ===========================================================================
  insert into audit_log (business_id, user_id, actor_label, action, entity_type, entity_id, after, created_at)
  values
    (v_biz, v_uid, 'Alex Morgan',   'booking.created',     'booking', '33330000-0000-0000-0000-000000000001', '{"status":"confirmed"}'::jsonb, now() - interval '21 days'),
    (v_biz, v_st1, 'Tom Fletcher',  'booking.checked_in',  'booking', '33330000-0000-0000-0000-000000000001', '{"status":"checked_in"}'::jsonb, (v_today - 3) + time '10:15'),
    (v_biz, v_uid, 'Alex Morgan',   'vaccination.verified','pet',     '22220000-0000-0000-0000-000000000003', '{"vaccination_type":"DHP (Distemper/Hepatitis/Parvo)"}'::jsonb, now() - interval '40 days'),
    (v_biz, v_mgr, 'Rebecca Shaw',  'booking.checked_in',  'booking', '33330000-0000-0000-0000-000000000004', '{"status":"checked_in"}'::jsonb, (v_today - 1) + time '11:20'),
    (v_biz, v_uid, 'Alex Morgan',   'booking.status_changed','booking','33330000-0000-0000-0000-000000000013', '{"status":"waiting_list"}'::jsonb, now() - interval '1 day');

  raise notice 'PawBoard demo seed complete for business % (owner %).', v_biz, v_owner_email;
end $$;

commit;
