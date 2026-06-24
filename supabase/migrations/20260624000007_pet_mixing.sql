-- =============================================================================
-- PawBoard — Pet mixing preference
-- Migration: 20260624000007_pet_mixing.sql
-- =============================================================================

alter table pets
  add column if not exists can_mix_with_others boolean not null default true;
