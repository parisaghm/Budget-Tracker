-- Align series_start_date with the bill's first due date when missing (avoids due_day-only drift).
update public.recurring_bills
set series_start_date = next_due_date
where series_start_date is null;
