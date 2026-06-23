-- =============================================================================
-- PawBoard — Initial Schema
-- Migration: 20260622000000_initial_schema.sql
--
-- Apply via:
--   Supabase Dashboard → SQL Editor → paste and run
--   OR: supabase db push  (if using Supabase CLI)
-- =============================================================================


-- =============================================================================
-- 1. ENUMS
-- =============================================================================

CREATE TYPE staff_role AS ENUM (
  'owner',      -- full access including billing and staff management
  'manager',    -- manage bookings, owners, pets, spaces; no billing
  'staff',      -- day-to-day operations
  'read_only'   -- view only; no edits
);

CREATE TYPE pet_sex AS ENUM (
  'male',
  'female',
  'unknown'
);

-- Used primarily for dogs; nullable on pets for other species
CREATE TYPE pet_size AS ENUM (
  'toy',
  'small',
  'medium',
  'large',
  'giant'
);

CREATE TYPE booking_status AS ENUM (
  'enquiry',              -- initial contact, not yet actioned
  'provisional',          -- tentatively held
  'confirmed',            -- booking confirmed by business
  'details_outstanding',  -- confirmed but owner info is incomplete
  'ready',                -- all details complete; ready for arrival
  'checked_in',           -- pet(s) are on-site
  'due_out',              -- due to check out today (set by daily process)
  'checked_out',          -- stay completed
  'cancelled',
  'waiting_list'
);

CREATE TYPE subscription_plan AS ENUM (
  'diary',          -- £5/month — up to 5 spaces, 1 user
  'professional',   -- £29/month — up to 30 spaces
  'premium'         -- £69/month — unlimited + multi-location
);


-- =============================================================================
-- 2. UTILITY: updated_at TRIGGER
-- Applied to all tables that have an updated_at column.
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- 3. TABLES (in foreign-key dependency order)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3.1  businesses — one row per kennel / cattery tenant
-- ---------------------------------------------------------------------------
CREATE TABLE businesses (
  id                uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text              NOT NULL,
  -- URL-safe slug, e.g. "oakwood-kennels" — used for internal routing
  slug              text              NOT NULL UNIQUE,
  email             text,
  phone             text,
  address_line1     text,
  address_line2     text,
  city              text,
  postcode          text,
  country           text              NOT NULL DEFAULT 'GB',
  website           text,
  licence_number    text,
  vat_number        text,
  subscription_plan subscription_plan NOT NULL DEFAULT 'professional',
  is_active         boolean           NOT NULL DEFAULT true,
  created_at        timestamptz       NOT NULL DEFAULT now(),
  updated_at        timestamptz       NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3.2  business_settings — operational configuration
-- ---------------------------------------------------------------------------
CREATE TABLE business_settings (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  checkin_time                time        NOT NULL DEFAULT '10:00',
  checkout_time               time        NOT NULL DEFAULT '11:00',
  booking_min_notice_hours    integer     NOT NULL DEFAULT 0,
  booking_max_advance_days    integer     NOT NULL DEFAULT 365,
  require_vaccination_proof   boolean     NOT NULL DEFAULT true,
  require_vet_details         boolean     NOT NULL DEFAULT true,
  allow_same_day_bookings     boolean     NOT NULL DEFAULT false,
  send_booking_confirmation   boolean     NOT NULL DEFAULT true,
  reminder_days_before        integer     NOT NULL DEFAULT 2,
  timezone                    text        NOT NULL DEFAULT 'Europe/London',
  currency                    text        NOT NULL DEFAULT 'GBP',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

-- ---------------------------------------------------------------------------
-- 3.3  business_theme — branding (logo, colours)
-- ---------------------------------------------------------------------------
CREATE TABLE business_theme (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  logo_url          text,
  primary_colour    text        NOT NULL DEFAULT '#059669',   -- emerald-600
  secondary_colour  text        NOT NULL DEFAULT '#0f172a',   -- slate-900
  accent_colour     text        NOT NULL DEFAULT '#f59e0b',   -- amber-500
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

-- ---------------------------------------------------------------------------
-- 3.4  species — system defaults (business_id IS NULL) + custom per business
--
-- System defaults (Dogs, Cats) have business_id = NULL and are visible to all.
-- Businesses on Professional/Premium can add custom species.
-- ---------------------------------------------------------------------------
CREATE TABLE species (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        REFERENCES businesses(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  plural_name       text        NOT NULL,
  icon              text,       -- emoji or icon key
  colour            text,       -- hex colour for calendar display
  is_system_default boolean     NOT NULL DEFAULT false,
  is_active         boolean     NOT NULL DEFAULT true,
  sort_order        integer     NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate species names within the same business (and among system defaults)
  CONSTRAINT species_name_unique_per_business
    UNIQUE NULLS NOT DISTINCT (business_id, name)
);

-- ---------------------------------------------------------------------------
-- 3.5  staff_users — linked 1:1 with Supabase auth.users
-- ---------------------------------------------------------------------------
CREATE TABLE staff_users (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role          staff_role  NOT NULL DEFAULT 'staff',
  first_name    text        NOT NULL,
  last_name     text        NOT NULL,
  email         text        NOT NULL,
  phone         text,
  is_active     boolean     NOT NULL DEFAULT true,
  invited_at    timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3.6  accommodation_areas — logical groupings, e.g. "Dog Block A", "Main Cattery"
-- ---------------------------------------------------------------------------
CREATE TABLE accommodation_areas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  is_active     boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid        REFERENCES auth.users(id)
);

-- ---------------------------------------------------------------------------
-- 3.7  accommodation_space_types — reusable templates, e.g. "Standard Kennel"
-- ---------------------------------------------------------------------------
CREATE TABLE accommodation_space_types (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3.8  accommodation_spaces — individual bookable units
--
-- Species compatibility is stored in accommodation_space_species (3.9).
-- Capacity rules are inline: max_pets, same_household_only, allowed_pet_sizes.
--
-- NOTE: Preventing overlapping bookings for the same space is enforced at the
-- application layer (availability query) rather than a DB exclusion constraint,
-- for simplicity in the MVP. A GIST exclusion constraint can be added later.
-- ---------------------------------------------------------------------------
CREATE TABLE accommodation_spaces (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  area_id                 uuid        NOT NULL REFERENCES accommodation_areas(id) ON DELETE RESTRICT,
  space_type_id           uuid        REFERENCES accommodation_space_types(id) ON DELETE SET NULL,
  name                    text        NOT NULL,
  -- Capacity rules
  max_pets                integer     NOT NULL DEFAULT 1 CHECK (max_pets >= 1),
  same_household_only     boolean     NOT NULL DEFAULT true,
  allow_mixed_species     boolean     NOT NULL DEFAULT false,
  requires_staff_approval boolean     NOT NULL DEFAULT false,
  -- NULL = all sizes welcome; non-null = only listed sizes allowed
  allowed_pet_sizes       pet_size[],
  notes                   text,
  is_active               boolean     NOT NULL DEFAULT true,
  sort_order              integer     NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid        REFERENCES auth.users(id)
);

-- ---------------------------------------------------------------------------
-- 3.9  accommodation_space_species — which species may use each space
--
-- A space with only one species entry is single-species.
-- A space with multiple entries is multi-species (requires allow_mixed_species = true).
-- ---------------------------------------------------------------------------
CREATE TABLE accommodation_space_species (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    uuid  NOT NULL REFERENCES accommodation_spaces(id) ON DELETE CASCADE,
  species_id  uuid  NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  -- Denormalised for RLS; must match the space's business
  business_id uuid  NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE (space_id, species_id)
);

-- ---------------------------------------------------------------------------
-- 3.10  owners — customer / household records
-- ---------------------------------------------------------------------------
CREATE TABLE owners (
  id                                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                         uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_name                          text        NOT NULL,
  last_name                           text        NOT NULL,
  email                               text,
  phone                               text        NOT NULL,
  phone_secondary                     text,
  address_line1                       text,
  address_line2                       text,
  city                                text,
  postcode                            text,
  emergency_contact_name              text,
  emergency_contact_phone             text,
  emergency_contact_relationship      text,
  emergency_contact_can_authorise_vet boolean     NOT NULL DEFAULT false,
  notes                               text,
  -- Linked when owner creates a portal account (Phase 4)
  portal_user_id                      uuid        REFERENCES auth.users(id),
  is_active                           boolean     NOT NULL DEFAULT true,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now(),
  created_by                          uuid        REFERENCES auth.users(id)
);

-- ---------------------------------------------------------------------------
-- 3.11  pets — linked to an owner; species-aware
-- ---------------------------------------------------------------------------
CREATE TABLE pets (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  owner_id                uuid        NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  species_id              uuid        NOT NULL REFERENCES species(id) ON DELETE RESTRICT,
  name                    text        NOT NULL,
  breed                   text,
  date_of_birth           date,
  sex                     pet_sex     NOT NULL DEFAULT 'unknown',
  is_neutered             boolean,
  colour_markings         text,
  photo_url               text,
  microchip_number        text,
  -- size: primarily for dogs; NULL for cats and other species
  size                    pet_size,
  vet_practice_name       text,
  vet_name                text,
  vet_phone               text,
  vet_address             text,
  insurance_provider      text,
  insurance_policy_number text,
  medical_notes           text,
  behaviour_notes         text,
  is_active               boolean     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid        REFERENCES auth.users(id)
);

-- ---------------------------------------------------------------------------
-- 3.12  bookings — one booking per owner per stay period
--
-- A booking can contain multiple pets (via booking_pets).
-- Each pet gets a space assignment (via booking_space_assignments).
-- A booking may mix species; space assignments enforce species compatibility.
-- ---------------------------------------------------------------------------
CREATE TABLE bookings (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid            NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  owner_id        uuid            NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  status          booking_status  NOT NULL DEFAULT 'enquiry',
  start_date      date            NOT NULL,
  end_date        date            NOT NULL,
  -- How the booking was taken: 'phone', 'walk_in', 'email', 'portal', 'manual'
  source          text            NOT NULL DEFAULT 'phone',
  notes           text,
  checked_in_at   timestamptz,
  checked_in_by   uuid            REFERENCES auth.users(id),
  checked_out_at  timestamptz,
  checked_out_by  uuid            REFERENCES auth.users(id),
  -- Basic financial tracking; Stripe integration added in a later phase
  deposit_amount  numeric(10,2),
  deposit_paid    boolean         NOT NULL DEFAULT false,
  deposit_paid_at timestamptz,
  total_amount    numeric(10,2),
  balance_paid    boolean         NOT NULL DEFAULT false,
  balance_paid_at timestamptz,
  created_at      timestamptz     NOT NULL DEFAULT now(),
  updated_at      timestamptz     NOT NULL DEFAULT now(),
  created_by      uuid            REFERENCES auth.users(id),
  CONSTRAINT bookings_dates_valid CHECK (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- 3.13  booking_pets — which pets are included in a booking
-- ---------------------------------------------------------------------------
CREATE TABLE booking_pets (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            uuid        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pet_id                uuid        NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
  -- Denormalised for RLS
  business_id           uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- Per-stay care notes (may differ from the pet's standing instructions)
  feeding_instructions  text,
  medication_notes      text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, pet_id)
);

-- ---------------------------------------------------------------------------
-- 3.14  booking_space_assignments — which space each booking-pet is assigned to
--
-- References booking_pets (not bookings directly) so each pet's space is tracked
-- independently. Both dog and cat pets in the same booking get separate entries
-- pointing to their respective species-compatible spaces.
-- ---------------------------------------------------------------------------
CREATE TABLE booking_space_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_pet_id  uuid        NOT NULL REFERENCES booking_pets(id) ON DELETE CASCADE,
  space_id        uuid        NOT NULL REFERENCES accommodation_spaces(id) ON DELETE RESTRICT,
  -- Denormalised for RLS and for date-range availability queries
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  start_date      date        NOT NULL,
  end_date        date        NOT NULL,
  notes           text,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  assigned_by     uuid        REFERENCES auth.users(id),
  CONSTRAINT space_assignment_dates_valid CHECK (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- 3.15  vaccinations — vaccination records per pet
-- ---------------------------------------------------------------------------
CREATE TABLE vaccinations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id            uuid        NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  -- Denormalised for RLS; also scopes verification to the business
  business_id       uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vaccination_type  text        NOT NULL, -- e.g. "Kennel Cough", "Cat Flu"
  administered_date date,
  expiry_date       date,
  document_url      text,       -- Supabase Storage URL (signed URL generated at read time)
  is_verified       boolean     NOT NULL DEFAULT false,
  verified_by       uuid        REFERENCES auth.users(id),
  verified_at       timestamptz,
  is_rejected       boolean     NOT NULL DEFAULT false,
  rejection_reason  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid        REFERENCES auth.users(id)
);

-- ---------------------------------------------------------------------------
-- 3.16  audit_log — append-only record of important actions
--
-- Written by application code and edge functions. No UPDATE or DELETE
-- RLS policies are created, so those operations are effectively denied
-- for all authenticated users.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users(id),
  -- e.g. 'booking', 'pet', 'owner', 'vaccination', 'space_assignment'
  entity_type   text        NOT NULL,
  entity_id     uuid        NOT NULL,
  -- e.g. 'created', 'updated', 'status_changed', 'checked_in', 'verified'
  action        text        NOT NULL,
  -- Before/after snapshot or relevant context as JSON
  payload       jsonb,
  ip_address    inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 4. INDEXES
-- =============================================================================

-- businesses
CREATE INDEX idx_businesses_active ON businesses(is_active);

-- staff_users
CREATE INDEX idx_staff_users_business_id     ON staff_users(business_id);
CREATE INDEX idx_staff_users_business_active ON staff_users(business_id, is_active);

-- species
CREATE INDEX idx_species_business_id   ON species(business_id);
CREATE INDEX idx_species_system_default ON species(is_system_default) WHERE is_system_default = true;

-- accommodation
CREATE INDEX idx_areas_business_id          ON accommodation_areas(business_id);
CREATE INDEX idx_space_types_business_id    ON accommodation_space_types(business_id);
CREATE INDEX idx_spaces_business_id         ON accommodation_spaces(business_id);
CREATE INDEX idx_spaces_area_id             ON accommodation_spaces(area_id);
CREATE INDEX idx_spaces_active              ON accommodation_spaces(business_id, is_active);
CREATE INDEX idx_space_species_space_id     ON accommodation_space_species(space_id);
CREATE INDEX idx_space_species_species_id   ON accommodation_space_species(species_id);
CREATE INDEX idx_space_species_business_id  ON accommodation_space_species(business_id);

-- owners
CREATE INDEX idx_owners_business_id     ON owners(business_id);
CREATE INDEX idx_owners_business_active ON owners(business_id, is_active);
CREATE INDEX idx_owners_last_name       ON owners(business_id, last_name);
CREATE INDEX idx_owners_email           ON owners(business_id, email) WHERE email IS NOT NULL;

-- pets
CREATE INDEX idx_pets_business_id ON pets(business_id);
CREATE INDEX idx_pets_owner_id    ON pets(owner_id);
CREATE INDEX idx_pets_species_id  ON pets(species_id);
CREATE INDEX idx_pets_active      ON pets(business_id, is_active);

-- bookings — critical for calendar queries
CREATE INDEX idx_bookings_business_id ON bookings(business_id);
CREATE INDEX idx_bookings_owner_id    ON bookings(owner_id);
CREATE INDEX idx_bookings_status      ON bookings(business_id, status);
CREATE INDEX idx_bookings_date_range  ON bookings(business_id, start_date, end_date);
CREATE INDEX idx_bookings_start_date  ON bookings(business_id, start_date);

-- booking_pets
CREATE INDEX idx_booking_pets_booking_id  ON booking_pets(booking_id);
CREATE INDEX idx_booking_pets_pet_id      ON booking_pets(pet_id);
CREATE INDEX idx_booking_pets_business_id ON booking_pets(business_id);

-- booking_space_assignments — critical for availability queries
CREATE INDEX idx_bsa_booking_pet_id  ON booking_space_assignments(booking_pet_id);
CREATE INDEX idx_bsa_space_id        ON booking_space_assignments(space_id);
CREATE INDEX idx_bsa_space_dates     ON booking_space_assignments(space_id, start_date, end_date);
CREATE INDEX idx_bsa_business_id     ON booking_space_assignments(business_id);

-- vaccinations
CREATE INDEX idx_vaccinations_pet_id      ON vaccinations(pet_id);
CREATE INDEX idx_vaccinations_expiry      ON vaccinations(pet_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_vaccinations_unverified  ON vaccinations(business_id, is_verified)
  WHERE is_verified = false AND is_rejected = false;

-- audit_log
CREATE INDEX idx_audit_log_business_id ON audit_log(business_id);
CREATE INDEX idx_audit_log_entity      ON audit_log(business_id, entity_type, entity_id);
CREATE INDEX idx_audit_log_recent      ON audit_log(business_id, created_at DESC);


-- =============================================================================
-- 5. UPDATED_AT TRIGGERS
-- =============================================================================

CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_business_settings_updated_at
  BEFORE UPDATE ON business_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_business_theme_updated_at
  BEFORE UPDATE ON business_theme
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_staff_users_updated_at
  BEFORE UPDATE ON staff_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_accommodation_areas_updated_at
  BEFORE UPDATE ON accommodation_areas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_accommodation_space_types_updated_at
  BEFORE UPDATE ON accommodation_space_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_accommodation_spaces_updated_at
  BEFORE UPDATE ON accommodation_spaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pets_updated_at
  BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vaccinations_updated_at
  BEFORE UPDATE ON vaccinations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 6. SEED DATA — system-wide default species
-- =============================================================================

-- These rows have business_id = NULL so they are visible to all tenants.
-- Fixed UUIDs allow idempotent re-runs and reliable foreign-key references
-- from application constants.

INSERT INTO species (id, business_id, name, plural_name, icon, colour, is_system_default, is_active, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, NULL, 'Dog', 'Dogs', '🐕', '#059669', true, true, 1),
  ('00000000-0000-0000-0000-000000000002'::uuid, NULL, 'Cat', 'Cats', '🐈', '#6366f1', true, true, 2)
ON CONFLICT (id) DO NOTHING;
