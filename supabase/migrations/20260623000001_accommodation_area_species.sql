-- Tracks which species are permitted in each accommodation area.
-- e.g. "Dog Block A" → Dogs only; "Main Cattery" → Cats only
-- Species restrictions on individual spaces (accommodation_space_species) remain
-- the authoritative constraint; this table provides the area-level label.

CREATE TABLE accommodation_area_species (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id     uuid NOT NULL REFERENCES accommodation_areas(id) ON DELETE CASCADE,
  species_id  uuid NOT NULL REFERENCES species(id)             ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id)          ON DELETE CASCADE,
  UNIQUE (area_id, species_id)
);

CREATE INDEX idx_area_species_area_id     ON accommodation_area_species(area_id);
CREATE INDEX idx_area_species_species_id  ON accommodation_area_species(species_id);
CREATE INDEX idx_area_species_business_id ON accommodation_area_species(business_id);

ALTER TABLE accommodation_area_species ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accommodation_area_species_tenant_isolation" ON accommodation_area_species
  FOR ALL
  USING  (business_id = get_current_business_id())
  WITH CHECK (business_id = get_current_business_id());
