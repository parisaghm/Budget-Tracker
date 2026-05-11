create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount_cents integer not null check (amount_cents >= 0),
  category text not null,
  due_day integer not null check (due_day between 1 and 31),
  frequency text not null check (frequency in ('monthly', 'weekly', 'biweekly', 'yearly')),
  status text not null default 'upcoming' check (status in ('upcoming', 'paid', 'skipped')),
  last_paid_date date,
  next_due_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_bills_user_id_idx on public.recurring_bills (user_id);
create index if not exists recurring_bills_next_due_date_idx on public.recurring_bills (next_due_date);
create unique index if not exists recurring_bills_user_name_due_uidx
  on public.recurring_bills (user_id, name, next_due_date);

alter table if exists public.recurring_bills enable row level security;

drop policy if exists "recurring_bills_select_own" on public.recurring_bills;
drop policy if exists "recurring_bills_insert_own" on public.recurring_bills;
drop policy if exists "recurring_bills_update_own" on public.recurring_bills;
drop policy if exists "recurring_bills_delete_own" on public.recurring_bills;

create policy "recurring_bills_select_own" on public.recurring_bills
  for select to authenticated using (user_id = auth.uid());

create policy "recurring_bills_insert_own" on public.recurring_bills
  for insert to authenticated with check (user_id = auth.uid());

create policy "recurring_bills_update_own" on public.recurring_bills
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "recurring_bills_delete_own" on public.recurring_bills
  for delete to authenticated using (user_id = auth.uid());
