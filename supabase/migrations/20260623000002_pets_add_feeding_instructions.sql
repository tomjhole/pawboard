-- Add default feeding instructions to pet records.
-- Per-booking overrides remain on booking_pets.feeding_instructions.
ALTER TABLE pets ADD COLUMN IF NOT EXISTS feeding_instructions text;
