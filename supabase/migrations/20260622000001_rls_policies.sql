-- =============================================================================
-- PawBoard — Row Level Security Policies
-- Migration: 20260622000001_rls_policies.sql
--
-- Run AFTER 20260622000000_initial_schema.sql
--
-- Design:
--   • Every table with business_id is fully tenant-isolated.
--   • The helper function get_current_business_id() uses SECURITY DEFINER
--     to bypass RLS when looking up the caller's own business, avoiding
--     circular-dependency issues on staff_users.
--   • species has special handling: system defaults (business_id IS NULL)
--     are readable by all authenticated staff.
--   • audit_log is append-only: no UPDATE or DELETE policies are created,
--     so those operations are denied for all client connections.
-- =============================================================================


-- =============================================================================
-- 1. HELPER FUNCTION
-- =============================================================================

-- SECURITY DEFINER bypasses RLS on staff_users to safely resolve the
-- current user's business without circular policy recursion.
CREATE OR REPLACE FUNCTION get_current_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id
  FROM   staff_users
  WHERE  id        = auth.uid()
  AND    is_active = true
  LIMIT  1;
$$;


-- =============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE businesses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_theme              ENABLE ROW LEVEL SECURITY;
ALTER TABLE species                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_areas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_space_types   ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_spaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_space_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_pets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_space_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccinations                ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                   ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 3. POLICIES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
CREATE POLICY "businesses_tenant_isolation" ON businesses
  FOR ALL
  USING  (id = get_current_business_id())
  WITH CHECK (id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- business_settings
-- ---------------------------------------------------------------------------
CREATE POLICY "business_settings_tenant_isolation" ON business_settings
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- business_theme
-- ---------------------------------------------------------------------------
CREATE POLICY "business_theme_tenant_isolation" ON business_theme
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- species
-- SELECT: system defaults (NULL business_id) + own business's custom species
-- INSERT / UPDATE / DELETE: own business only (cannot modify system defaults)
-- ---------------------------------------------------------------------------
CREATE POLICY "species_select" ON species
  FOR SELECT
  USING (
    business_id IS NULL
    OR business_id = get_current_business_id()
  );

CREATE POLICY "species_insert" ON species
  FOR INSERT
  WITH CHECK (business_id = get_current_business_id());

CREATE POLICY "species_update" ON species
  FOR UPDATE
  USING     (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

CREATE POLICY "species_delete" ON species
  FOR DELETE
  USING (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- staff_users
-- All staff in the same business can see each other's records.
-- Role-based permission checks (e.g. only owners can manage staff) are
-- enforced at the application layer, not here.
-- ---------------------------------------------------------------------------
CREATE POLICY "staff_users_tenant_isolation" ON staff_users
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- accommodation_areas
-- ---------------------------------------------------------------------------
CREATE POLICY "accommodation_areas_tenant_isolation" ON accommodation_areas
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- accommodation_space_types
-- ---------------------------------------------------------------------------
CREATE POLICY "accommodation_space_types_tenant_isolation" ON accommodation_space_types
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- accommodation_spaces
-- ---------------------------------------------------------------------------
CREATE POLICY "accommodation_spaces_tenant_isolation" ON accommodation_spaces
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- accommodation_space_species
-- ---------------------------------------------------------------------------
CREATE POLICY "accommodation_space_species_tenant_isolation" ON accommodation_space_species
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- owners
-- ---------------------------------------------------------------------------
CREATE POLICY "owners_tenant_isolation" ON owners
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- pets
-- ---------------------------------------------------------------------------
CREATE POLICY "pets_tenant_isolation" ON pets
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
CREATE POLICY "bookings_tenant_isolation" ON bookings
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- booking_pets
-- ---------------------------------------------------------------------------
CREATE POLICY "booking_pets_tenant_isolation" ON booking_pets
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- booking_space_assignments
-- ---------------------------------------------------------------------------
CREATE POLICY "booking_space_assignments_tenant_isolation" ON booking_space_assignments
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- vaccinations
-- ---------------------------------------------------------------------------
CREATE POLICY "vaccinations_tenant_isolation" ON vaccinations
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());

-- ---------------------------------------------------------------------------
-- audit_log — append-only
-- Staff can read their business's log and insert new entries.
-- No UPDATE or DELETE policies → those operations are denied for clients.
-- In production, inserts should be made via Edge Functions using the
-- service-role key for tamper-proof audit integrity.
-- ---------------------------------------------------------------------------
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT
  USING (business_id = get_current_business_id());

CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT
  WITH CHECK (business_id = get_current_business_id());
