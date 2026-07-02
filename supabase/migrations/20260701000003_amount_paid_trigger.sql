-- =============================================================================
-- Keep bookings.amount_paid authoritative via a trigger on the payments ledger,
-- so it stays correct no matter how payments are written (the app, the demo
-- seed / regenerate_demo_data, or manual SQL). amount_paid is net of refunds.
-- =============================================================================

create or replace function recalc_booking_amount_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking uuid := coalesce(new.booking_id, old.booking_id);
begin
  update bookings b
  set amount_paid = coalesce((
    select sum(case when p.kind = 'refund' then -p.amount else p.amount end)
    from payments p
    where p.booking_id = v_booking and p.status = 'paid'
  ), 0)
  where b.id = v_booking;
  return null;
end;
$$;

drop trigger if exists trg_payments_recalc_paid on payments;
create trigger trg_payments_recalc_paid
  after insert or update or delete on payments
  for each row execute function recalc_booking_amount_paid();

-- Re-backfill now that the helper exists (covers any rows created since the
-- previous migration).
update bookings b
set amount_paid = coalesce((
  select sum(case when p.kind = 'refund' then -p.amount else p.amount end)
  from payments p
  where p.booking_id = b.id and p.status = 'paid'
), 0);
