-- Add a general notes field to businesses (e.g. opening hours, directions, welcome message)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notes text;
