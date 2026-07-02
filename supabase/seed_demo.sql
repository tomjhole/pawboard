-- =============================================================================
-- PawBoard — Demo seed data
--
-- Superseded by supabase/migrations/20260701000000_regenerate_demo_data.sql,
-- which defines `regenerate_demo_data()` — the same logic, but scoped so it
-- only ever touches the Oakwood demo tenant's own rows (safe on a shared
-- production database), and callable from the Admin page ("Regenerate demo
-- data" button) without needing the SQL Editor.
--
-- This file is kept only as a manual SQL-Editor fallback. Change the email
-- below to whichever account you're logged in with, then run it.
-- =============================================================================

select regenerate_demo_data('tomjhole@msn.com');
