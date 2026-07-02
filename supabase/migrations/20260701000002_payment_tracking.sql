-- =============================================================================
-- Payment tracking — persist net-paid on the booking so list views (Operations,
-- Bookings, reports) can show exact outstanding balances without joining the
-- payments ledger, and so a derived payment status can be computed cheaply.
-- =============================================================================

alter table bookings
  add column if not exists amount_paid numeric(10,2) not null default 0;

-- Backfill from the ledger (net of refunds).
update bookings b
set amount_paid = coalesce((
  select sum(case when p.kind = 'refund' then -p.amount else p.amount end)
  from payments p
  where p.booking_id = b.id and p.status = 'paid'
), 0);
