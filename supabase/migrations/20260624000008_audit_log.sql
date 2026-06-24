-- =============================================================================
-- PawBoard — Audit log: add structured before/after/meta columns
-- Migration: 20260624000008_audit_log.sql
-- =============================================================================

alter table audit_log
  add column if not exists actor_label text,
  add column if not exists before      jsonb,
  add column if not exists after       jsonb,
  add column if not exists meta        jsonb;
