-- =============================================================================
-- PawBoard — Setup wizard completion flag
-- Migration: 20260627000000_setup_wizard.sql
--
-- Tracks whether a business has finished (or dismissed) the first-run setup
-- wizard, so we can show a "finish setting up" prompt until it's done.
-- =============================================================================

alter table business_settings
  add column if not exists setup_completed_at timestamptz;

-- Businesses that already have bookable spaces are clearly set up — don't nag them.
update business_settings bs
set    setup_completed_at = now()
where  bs.setup_completed_at is null
  and  exists (select 1 from accommodation_spaces s where s.business_id = bs.business_id);
