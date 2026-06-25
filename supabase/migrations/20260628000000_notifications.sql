-- =============================================================================
-- PawBoard — Phase: Email notifications
-- Migration: 20260628000000_notifications.sql
--
-- A send-log for de-dupe/audit, plus per-business toggles for which automatic
-- emails go out. Emails are sent by the send-email / send-reminders Edge
-- Functions via Resend (see supabase/functions/README.md). Nothing here sends
-- mail by itself.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Notification toggles on business_settings
--    (send_booking_confirmation + reminder_days_before already exist)
-- -----------------------------------------------------------------------------
alter table business_settings
  add column if not exists email_enabled               boolean not null default true,
  add column if not exists notify_booking_changes      boolean not null default true,
  add column if not exists notify_cancellation         boolean not null default true,
  add column if not exists notify_payment_receipt      boolean not null default true,
  add column if not exists notify_booking_request      boolean not null default true,
  add column if not exists notify_arrival_reminder     boolean not null default true,
  add column if not exists notify_vaccination_reminder boolean not null default true,
  add column if not exists vaccination_reminder_days   integer not null default 21;

-- -----------------------------------------------------------------------------
-- 2. Email send log (audit + idempotency / de-dupe of reminders)
-- -----------------------------------------------------------------------------
create table if not exists email_log (
  id           uuid        primary key default gen_random_uuid(),
  business_id  uuid        not null references businesses(id) on delete cascade,
  to_email     text        not null,
  type         text        not null,
  subject      text,
  related_type text,
  related_id   uuid,
  status       text        not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  provider_id  text,
  error        text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);

create index if not exists idx_email_log_business on email_log(business_id, created_at desc);
create index if not exists idx_email_log_dedupe   on email_log(business_id, type, related_id);

alter table email_log enable row level security;

-- Staff can read their business's log. Inserts happen via the service-role key
-- inside the Edge Functions, so no client insert policy is created.
drop policy if exists "email_log_tenant_select" on email_log;
create policy "email_log_tenant_select" on email_log for select
  using (business_id = get_current_business_id());
