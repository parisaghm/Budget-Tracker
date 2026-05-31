alter table public.recurring_bills
  add column if not exists payment_count integer
    check (payment_count is null or payment_count >= 1),
  add column if not exists payments_completed integer not null default 0
    check (payments_completed >= 0),
  add column if not exists series_start_date date;

alter table public.recurring_bills
  drop constraint if exists recurring_bills_payments_completed_lte_count;

alter table public.recurring_bills
  add constraint recurring_bills_payments_completed_lte_count
  check (
    payment_count is null
    or payments_completed <= payment_count
  );
